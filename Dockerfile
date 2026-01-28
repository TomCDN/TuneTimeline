# Use an official Python runtime as a parent image
FROM python:3.11-slim

# Set the working directory in the container
WORKDIR /app

# Install system dependencies if needed (e.g., for eventlet)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy the requirements file into the container at /app
COPY requirements.txt .

# Install any needed packages specified in requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code into the container
COPY . .

# Make port 3000 available to the world outside this container
EXPOSE 3000

# Define environment variables
ENV FLASK_APP=app.py
ENV FLASK_DEBUG=false
ENV PORT=3000

# Run app.py when the container launches
CMD ["python", "app.py"]
