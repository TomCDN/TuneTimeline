import eventlet
eventlet.monkey_patch()

import os
import secrets
import random
import string
from flask import Flask, send_from_directory, request
from flask_socketio import SocketIO, emit, join_room

app = Flask(__name__, static_folder='public', static_url_path='')
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', secrets.token_hex(32))
# Enhanced Socket.IO configuration for mobile stability
socketio = SocketIO(
    app, 
    cors_allowed_origins="*", 
    async_mode='eventlet', 
    logger=True, 
    engineio_logger=True,
    ping_timeout=60,
    ping_interval=25,
    manage_session=False # Often better for mobile devices
)

import requests
import re
import json

# Game State Storage
rooms = {}
admins = set() # Store SIDs of authenticated admins

ADMIN_PASSWORD = 'MASTER'

def generate_room_code():
    return ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(5))

def auto_insert_song(timeline, song):
    # Inserts song and returns the new timeline sorted by year
    timeline.append(song)
    timeline.sort(key=lambda x: x['year'])
    return timeline

def get_correct_pos(timeline, song_year):
    # Finds the correct index (0-based) for a song in a sorted timeline
    for i, existing in enumerate(timeline):
        if existing['year'] > song_year:
            return i
    return len(timeline)

def perform_reveal(room_code):
    """Helper function to perform the year reveal logic."""
    if room_code not in rooms:
        return
    
    room = rooms[room_code]
    song = room.get('current_song')
    placement = room.get('current_placement')
    challenge = room.get('current_challenge')
    
    # Validate
    if not song or not placement:
        return
    
    actual_year = song['year']
    p_team = placement['teamId']
    p_pos = placement['pos']
    
    # Calculate where the song SHOULD have gone
    p_timeline = room['teams'][p_team]['timeline']
    correct_pos_on_p = get_correct_pos(p_timeline, actual_year)
    
    results = {
        'actualYear': actual_year,
        'placerCorrect': (p_pos == correct_pos_on_p),
        'challengerCorrect': False,
        'placement': placement,
        'challenge': challenge,
        'stolen': False
    }

    # Check challenger (if any)
    if challenge:
        c_team = challenge['teamId']
        c_pos = challenge['pos']
        room['teams'][c_team]['tokens'] -= 1  # Always spend token
        
        if c_pos == correct_pos_on_p:
            results['challengerCorrect'] = True
            results['stolen'] = True
            room['teams'][c_team]['timeline'] = auto_insert_song(room['teams'][c_team]['timeline'], song)
            room['teams'][c_team]['score'] += 1
        elif results['placerCorrect']:
            room['teams'][p_team]['timeline'] = auto_insert_song(room['teams'][p_team]['timeline'], song)
            room['teams'][p_team]['score'] += 1
    else:
        if results['placerCorrect']:
            room['teams'][p_team]['timeline'] = auto_insert_song(room['teams'][p_team]['timeline'], song)
            room['teams'][p_team]['score'] += 1

    # Rotate Turn
    room['active_team'] = 'team2' if room['active_team'] == 'team1' else 'team1'
    room['turn_state'] = 'playing'
    room['current_placement'] = None
    room['current_challenge'] = None
    
    # Check for winner
    winner = None
    if room['teams']['team1']['score'] >= room['target_score']: 
        winner = room['teams']['team1']['name']
    elif room['teams']['team2']['score'] >= room['target_score']: 
        winner = room['teams']['team2']['name']

    socketio.emit('year-revealed', {
        'results': results,
        'teams': room['teams'],
        'nextTeam': room['active_team'],
        'winner': winner
    }, to=room_code)

@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory(app.static_folder, path)

@socketio.on('connect')
def handle_connect():
    print(f'User connected: {socketio}')

DEFAULT_PLAYLIST_URL = "https://open.spotify.com/playlist/321iL49aeqqqtKfrQLO91I?si=bedb6d63e0034784"

def fetch_spotify_playlist(url):
    try:
        # Extract ID from a trusted Spotify domain
        if not url.startswith("https://open.spotify.com/"):
            raise Exception("Alleen Spotify links van open.spotify.com zijn toegestaan.")
        
        match = re.search(r'playlist/([a-zA-Z0-9]+)', url)
        if not match: raise Exception("Ongeldige Spotify URL. Kopieer de link vanuit Spotify.")
        
        playlist_id = match.group(1)
        print(f"Fetching Spotify playlist: {playlist_id}...")
        
        # Use a full browser User-Agent to avoid being blocked or getting 404s
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
        }
        
        response = requests.get(f"https://open.spotify.com/embed/playlist/{playlist_id}", timeout=15, headers=headers)
        
        if response.status_code != 200:
            raise Exception(f"Spotify gaf een foutmelding: {response.status_code}. Probeer het later opnieuw.")

        # Search for __NEXT_DATA__ block
        data_match = re.search(r'<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)</script>', response.text)
        if not data_match:
            # Fallback: maybe the ID is different?
            data_match = re.search(r'<script id="initial-state"[^>]*>([\s\S]*?)</script>', response.text)
            
        if data_match:
            full_data = json.loads(data_match.group(1))
            tracks = []
            
            # Try Path 1: props -> pageProps -> state -> data -> entity -> trackList (Current Embed)
            try:
                entity = full_data['props']['pageProps']['state']['data']['entity']
                tracks_raw = entity.get('trackList', [])
                for item in tracks_raw:
                    tracks.append({
                        'name': item.get('title', 'Unknown'),
                        'artist': item.get('subtitle', 'Unknown')
                    })
            except (KeyError, TypeError) as e:
                pass

            # Try Path 2: props -> pageProps -> data -> playlistV2 -> content -> items (Possible future/other format)
            if not tracks:
                try:
                    items = full_data['props']['pageProps']['data']['playlistV2']['content']['items']
                    for item in items:
                        track_data = item.get('item', {}).get('data', {})
                        if track_data:
                            tracks.append({
                                'name': track_data.get('name', 'Unknown'),
                                'artist': ', '.join([a.get('name') for a in track_data.get('artists', {}).get('items', [])])
                            })
                except (KeyError, TypeError) as e:
                    pass

            # Path 3: Emergency recursive search for anything that looks like tracks
            if not tracks:
                def recursive_find_tracks(obj):
                    if isinstance(obj, dict):
                        if 'trackList' in obj and isinstance(obj['trackList'], list):
                            return obj['trackList']
                        for v in obj.values():
                            res = recursive_find_tracks(v)
                            if res: return res
                    elif isinstance(obj, list):
                        for item in obj:
                            res = recursive_find_tracks(item)
                            if res: return res
                    return None
                
                found = recursive_find_tracks(full_data)
                if found:
                    for item in found:
                        if isinstance(item, dict):
                            tracks.append({
                                'name': item.get('title') or item.get('name') or 'Unknown',
                                'artist': item.get('subtitle') or item.get('artist') or 'Unknown'
                            })

            if not tracks:
                return []
                    
            return tracks
        else:
            return []
    except Exception as e:
        print(f"Spotify Error: {e}")
        return []

@socketio.on('create-room')
def handle_create_room(user_name):
    room_code = generate_room_code()
    rooms[room_code] = {
        'host': request.sid,
        'players': {}, # Use sid as key
        'teams': {
            'team1': {'name': 'Team 1', 'players': [], 'score': 0, 'tokens': 2, 'timeline': [], 'oracle': None, 'votes': {}},
            'team2': {'name': 'Team 2', 'players': [], 'score': 0, 'tokens': 2, 'timeline': [], 'oracle': None, 'votes': {}}
        },
        'game_state': 'lobby',
        'current_song': None,
        'active_team': 'team1',
        'target_score': 10,
        'token_claimed': False,
        'history': [],
        'playlist_tracks': []
    }
    
    # Auto-load default playlist
    def load_default():
        tracks = fetch_spotify_playlist(DEFAULT_PLAYLIST_URL)
        if room_code in rooms:
            rooms[room_code]['playlist_tracks'] = tracks
            print(f"Auto-loaded {len(tracks)} tracks for room {room_code}")
            sync_room_state(room_code)
            
    eventlet.spawn(load_default)

    # Add host to players (unassigned initially)
    rooms[room_code]['players'][request.sid] = {'name': user_name, 'team': None}
    
    join_room(room_code)
    emit('room-created', {'roomCode': room_code, 'userName': user_name})
    print(f'Room {room_code} created by {user_name}')

@socketio.on('join-room')
def handle_join_room(data):
    room_code = data.get('roomCode')
    user_name = data.get('userName')
    
    if room_code in rooms:
        rooms[room_code]['players'][request.sid] = {'name': user_name, 'team': None}
        join_room(room_code)
        sync_room_state(room_code)
        print(f'{user_name} joined room {room_code}')
    else:
        emit('error-msg', 'Room not found')

@socketio.on('join-team')
def handle_join_team(data):
    room_code = data.get('roomCode')
    team_id = data.get('team') # 'team1' or 'team2'
    
    if room_code in rooms and request.sid in rooms[room_code]['players']:
        player = rooms[room_code]['players'][request.sid]
        old_team = player.get('team')
        
        # Remove from old team if exists
        if old_team and old_team in rooms[room_code]['teams']:
            rooms[room_code]['teams'][old_team]['players'] = [
                p for p in rooms[room_code]['teams'][old_team]['players'] if p['sid'] != request.sid
            ]
            
        # Add to new team
        player['team'] = team_id
        rooms[room_code]['teams'][team_id]['players'].append({'sid': request.sid, 'name': player['name']})
        
        sync_room_state(room_code)

@socketio.on('set-team-name')
def handle_set_team_name(data):
    room_code = data.get('roomCode')
    team_id = data.get('team')
    new_name = data.get('name')
    
    if room_code in rooms and rooms[room_code]['host'] == request.sid:
        rooms[room_code]['teams'][team_id]['name'] = new_name
        sync_room_state(room_code)

def sync_room_state(room_code):
    room = rooms[room_code]
    # Simplify player list for emit
    players_data = {sid: p['name'] for sid, p in room['players'].items()}
    emit('room-update', {
        'roomCode': room_code,
        'players': players_data,
        'teams': room['teams'],
        'gameState': room['game_state'],
        'turnState': room.get('turn_state', 'playing'),
        'activeTeam': room.get('active_team', 'team1'),
        'currentPlacement': room.get('current_placement'),
        'currentChallenge': room.get('current_challenge'),
        'currentChallenge': room.get('current_challenge'),
        'targetScore': room.get('target_score', 10),
        'playlistTracks': room.get('playlist_tracks', []),
        'history': room.get('history', []),
        'host': room.get('host')
    }, to=room_code)

@socketio.on('admin-login')
def handle_admin_login(password):
    if password == ADMIN_PASSWORD:
        admins.add(request.sid)
        emit('admin-authenticated', True)
        print(f"Admin authenticated: {request.sid}")
    else:
        emit('admin-authenticated', False)
        emit('error-msg', 'Incorrect admin code!')

@socketio.on('game-action')
def handle_game_action(data):
    room_code = data.get('roomCode')
    action = data.get('action')
    action_data = data.get('data')
    
    if room_code not in rooms:
        emit('error-msg', 'Room not found.', to=request.sid)
        return

    room = rooms[room_code]
    is_host = (room['host'] == request.sid)
    is_admin = (request.sid in admins)

    # Validate high-privilege actions
    host_only_actions = ['start-game', 'init-starter-cards', 'play-song', 'reveal-year', 'set-target-score', 'set-oracle', 'randomize-teams', 'reset-game']
    admin_only_actions = ['fetch-playlist']

    if action in host_only_actions and not is_host and not is_admin:
        emit('error-msg', 'Only the host or an admin can perform this action.', to=request.sid)
        return
    
    if action in admin_only_actions and not is_admin:
        emit('error-msg', 'Admin privileges required.', to=request.sid)
        return
    
    if action == 'start-game':
        room['game_state'] = 'playing'
        room['active_team'] = 'team1'
        room['turn_state'] = 'playing' # playing, challenging, result
        # Initial timelines
        for t in room['teams'].values():
            t['timeline'] = []
            t['score'] = 0
            t['tokens'] = 2
            t['votes'] = {}
        
        sync_room_state(room_code)
        emit('game-started', to=room_code)

    elif action == 'init-starter-cards':
        room['teams']['team1']['timeline'] = [action_data['team1Song']]
        room['teams']['team2']['timeline'] = [action_data['team2Song']]
        # Add starter songs to history
        if 'history' not in room: room['history'] = []
        room['history'].extend([action_data['team1Song'], action_data['team2Song']])
        sync_room_state(room_code)

    elif action == 'play-song':
        room['current_song'] = action_data
        room['turn_state'] = 'playing'
        room['current_placement'] = None
        room['current_challenge'] = None
        room['token_claimed'] = False # Reset for new song
        
        # Add to history
        if 'history' not in room: room['history'] = []
        room['history'].append(action_data)
        
        sync_room_state(room_code)
        emit('new-song', {
            'songData': action_data,
            'activeTeam': room['active_team'],
            'turnState': room['turn_state']
        }, to=room_code)

    elif action == 'submit-vote':
        # Team member votes on a position
        team_id = action_data.get('teamId')
        pos = action_data.get('pos')
        
        room['teams'][team_id]['votes'][request.sid] = pos
        emit('vote-update', {'teamId': team_id, 'votes': room['teams'][team_id]['votes']}, to=room_code)

    elif action == 'reset-game':
        room['game_state'] = 'lobby'
        room['turn_state'] = 'playing'
        room['active_team'] = 'team1'
        room['current_song'] = None
        room['current_placement'] = None
        room['current_challenge'] = None
        room['token_claimed'] = False
        room['history'] = []
        
        # Reset teams but keep players
        for t in room['teams'].values():
            t['timeline'] = []
            t['score'] = 0
            t['tokens'] = 2
            t['votes'] = {}
        
        sync_room_state(room_code)
        emit('game-reset', to=room_code)

    
    elif action == 'confirm-placement':
        # Team confirms their placement after voting
        team_id = action_data.get('teamId')
        team = room['teams'][team_id]
        votes = team['votes']
        
        if not votes:
            emit('error-msg', 'Er zijn nog geen stemmen!', to=request.sid)
            return
        
        # Count votes per position
        vote_counts = {}
        for voter_sid, pos in votes.items():
            vote_counts[pos] = vote_counts.get(pos, 0) + 1
        
        # Find max votes
        max_votes = max(vote_counts.values())
        top_positions = [pos for pos, count in vote_counts.items() if count == max_votes]
        
        # If tie, check Oracle
        if len(top_positions) > 1 and team['oracle']:
            oracle_vote = votes.get(team['oracle'])
            if oracle_vote in top_positions:
                # Oracle's vote wins the tie
                winning_pos = oracle_vote
            else:
                # Oracle didn't vote for one of the ties, pick first
                winning_pos = top_positions[0]
        else:
            winning_pos = top_positions[0]
        
        # Clear votes for next round
        team['votes'] = {}
        
        # Now submit the actual placement
        room['current_placement'] = {'teamId': team_id, 'pos': winning_pos}
        room['turn_state'] = 'challenging'
        emit('placement-submitted', {
            'teamId': team_id,
            'pos': winning_pos,
            'turnState': room['turn_state']
        }, to=room_code)

    elif action == 'submit-placement':
        # Direct placement (for single player teams or legacy)
        room['current_placement'] = action_data # { teamId, pos }
        room['turn_state'] = 'challenging'
        emit('placement-submitted', {
            'teamId': action_data.get('teamId'),
            'pos': action_data.get('pos'),
            'turnState': room['turn_state']
        }, to=room_code)

    elif action == 'submit-challenge':
        # Opposing team challenges a placement
        room['current_challenge'] = action_data # { teamId, pos }
        emit('challenge-submitted', action_data, to=room_code)
        
        # Auto-reveal after challenge is submitted
        # Use eventlet.spawn_after for a slight delay so clients receive the challenge-submitted first
        def auto_reveal():
            perform_reveal(room_code)
        eventlet.spawn_after(1.5, auto_reveal)

    elif action == 'skip-challenge':
        # Opposing team skips the challenge - auto reveal
        emit('challenge-skipped', action_data, to=room_code)
        perform_reveal(room_code)

    elif action == 'reveal-year':
        # Host triggers reveal (manual backup)
        perform_reveal(room_code)

    elif action == 'set-target-score':
        if room['host'] == request.sid:
            room['target_score'] = int(action_data)
            sync_room_state(room_code)

    elif action == 'claim-token':
        team_id = action_data.get('teamId')
        
        # Check if already claimed for this song
        if room.get('token_claimed'):
             emit('error-msg', 'Token al geclaimd voor dit nummer!', to=request.sid)
             return

        if room['teams'][team_id]['tokens'] < 5:
            room['teams'][team_id]['tokens'] += 1
            room['token_claimed'] = True
            
            # Announce to everyone that token was claimed
            emit('token-claimed-announcement', {
                'teamId': team_id,
                'claimedBy': room['players'][request.sid]['name']
            }, to=room_code)
            
            sync_room_state(room_code)
        else:
            emit('error-msg', 'Maximaal 5 tokens bereikt!', to=request.sid)

    elif action == 'fetch-playlist':
        url = action_data
        tracks = fetch_spotify_playlist(url)
        if tracks:
            room['playlist_tracks'] = tracks
            print(f"Loaded {len(tracks)} tracks for room {room_code}")
            emit('playlist-loaded', {'count': len(tracks), 'tracks': tracks}, to=request.sid)
            sync_room_state(room_code)
        else:
            emit('error-msg', "Kon geen nummers vinden in de Spotify playlist of playlist is niet publiek.", to=request.sid)

    elif action == 'set-playlist-tracks':
        room['playlist_tracks'] = action_data
        # We don't necessarily need to sync this to everyone, just store it in the room
        print(f"Playlist updated for {room_code}")

    elif action == 'set-oracle':
        # Set the Oracle (Al-wetende) for a team
        team_id = action_data.get('teamId')
        oracle_sid = action_data.get('oracleSid')  # Can be None to remove
        
        if team_id not in room['teams']:
            return
        
        team = room['teams'][team_id]
        
        # Validate: Oracle can only be set if team has even number of players
        if oracle_sid:
            if len(team['players']) % 2 != 0:
                emit('error-msg', 'Al-wetende kan alleen worden ingesteld bij een even aantal spelers!', to=request.sid)
                return
            # Validate oracle is in team
            if not any(p['sid'] == oracle_sid for p in team['players']):
                emit('error-msg', 'Deze speler zit niet in het team!', to=request.sid)
                return
        
        team['oracle'] = oracle_sid
        sync_room_state(room_code)

    elif action == 'randomize-teams':
        if room['host'] == request.sid:
            # 1. Gather all players (sids)
            all_sids = list(room['players'].keys())
            
            # 2. Shuffle
            random.shuffle(all_sids)
            
            # 3. Clear existing team lists but keep stats
            room['teams']['team1']['players'] = []
            room['teams']['team2']['players'] = []
            room['teams']['team1']['oracle'] = None
            room['teams']['team2']['oracle'] = None
            
            # 4. Distribute
            for i, sid in enumerate(all_sids):
                player_name = room['players'][sid]['name']
                
                # Update player object
                target_team = 'team1' if i % 2 == 0 else 'team2'
                room['players'][sid]['team'] = target_team
                
                # Add to team list
                room['teams'][target_team]['players'].append({'sid': sid, 'name': player_name})
            
            # 5. Sync
            sync_room_state(room_code)

@socketio.on('disconnect')
def handle_disconnect():
    for room_code, room in list(rooms.items()):
        if request.sid in room['players']:
            del room['players'][request.sid]
            # Remove from teams
            for team in room['teams'].values():
                team['players'] = [p for p in team['players'] if p['sid'] != request.sid]
            
            # Delete room if empty
            if not room['players']:
                del rooms[room_code]
            else:
                # If host left, assign a new host
                if room['host'] == request.sid:
                    new_host_sid = next(iter(room['players']))
                    room['host'] = new_host_sid
                    print(f"Host left room {room_code}. New host: {room['players'][new_host_sid]['name']}")
                
                sync_room_state(room_code)
            break
            
    if request.sid in admins:
        admins.remove(request.sid)

if __name__ == '__main__':
    # Use environment variable to toggle debug mode, default to False for safety
    is_debug = os.environ.get('FLASK_DEBUG', 'false').lower() == 'true'
    socketio.run(app, debug=is_debug, port=3000, host='0.0.0.0')
