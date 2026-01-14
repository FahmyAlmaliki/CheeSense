#!/bin/bash

# CheeSense Docker Deployment Script
# Helper script untuk build dan deploy CheeSense Web Dashboard

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "=========================================="
echo "🧀 CheeSense Web Dashboard Deployment"
echo "=========================================="
echo ""

# Function to check if container is running
check_container() {
    local container=$1
    if docker ps --format '{{.Names}}' | grep -q "^${container}$"; then
        echo "✅ $container is running"
        return 0
    else
        echo "❌ $container is not running"
        return 1
    fi
}

# Function to check InfluxDB bucket
check_influxdb_bucket() {
    echo ""
    echo "📊 Checking InfluxDB setup..."
    
    if check_container "selene-influx-prod"; then
        echo ""
        echo "ℹ️  Please ensure the 'cheesense' bucket exists in InfluxDB"
        echo "   Access InfluxDB UI: http://localhost:8086"
        echo ""
    else
        echo "⚠️  InfluxDB container is not running!"
        echo "   Start it first: docker-compose up -d influxdb"
        echo ""
    fi
}

# Main menu
echo "Select an action:"
echo "1) Build CheeSense container"
echo "2) Start CheeSense (with dependencies)"
echo "3) Stop CheeSense"
echo "4) View logs"
echo "5) Restart CheeSense"
echo "6) Check status"
echo "7) Generate demo data"
echo "8) Full deployment (build + start all)"
echo "0) Exit"
echo ""
read -p "Enter choice [0-8]: " choice

case $choice in
    1)
        echo ""
        echo "🔨 Building CheeSense container..."
        cd "$PROJECT_ROOT"
        docker compose build cheesense-web
        echo "✅ Build complete!"
        ;;
    2)
        echo ""
        echo "🚀 Starting CheeSense and dependencies..."
        cd "$PROJECT_ROOT"
        docker compose up -d influxdb
        sleep 5
        docker compose up -d cheesense-web
        echo ""
        echo "✅ CheeSense started!"
        echo "🌐 Access dashboard at: http://localhost:8085"
        check_influxdb_bucket
        ;;
    3)
        echo ""
        echo "🛑 Stopping CheeSense..."
        cd "$PROJECT_ROOT"
        docker compose stop cheesense-web
        echo "✅ CheeSense stopped"
        ;;
    4)
        echo ""
        echo "📋 Showing logs (Ctrl+C to exit)..."
        cd "$PROJECT_ROOT"
        docker compose logs -f cheesense-web
        ;;
    5)
        echo ""
        echo "🔄 Restarting CheeSense..."
        cd "$PROJECT_ROOT"
        docker compose restart cheesense-web
        echo "✅ CheeSense restarted!"
        echo "🌐 Access dashboard at: http://localhost:8085"
        ;;
    6)
        echo ""
        echo "📊 Checking container status..."
        cd "$PROJECT_ROOT"
        docker compose ps cheesense-web influxdb
        echo ""
        check_container "selene-cheesense-web"
        check_container "selene-influx-prod"
        echo ""
        echo "🌐 Dashboard URL: http://localhost:8085"
        echo "📊 InfluxDB UI: http://localhost:8086"
        ;;
    7)
        echo ""
        echo "🎲 Generating demo data..."
        read -p "How many data points? [default: 50]: " count
        count=${count:-50}
        
        curl -s -X POST http://localhost:8085/api/demo/generate \
          -H "Content-Type: application/json" \
          -d "{\"count\": $count}" | jq '.'
        
        echo ""
        echo "✅ Demo data generated!"
        echo "🌐 View at: http://localhost:8085"
        ;;
    8)
        echo ""
        echo "🚀 Full deployment starting..."
        cd "$PROJECT_ROOT"
        
        echo "1️⃣  Building CheeSense..."
        docker compose build cheesense-web
        
        echo "2️⃣  Starting InfluxDB..."
        docker compose up -d influxdb
        
        echo "⏳ Waiting for InfluxDB to be ready..."
        sleep 10
        
        echo "3️⃣  Starting CheeSense..."
        docker compose up -d cheesense-web
        
        echo ""
        echo "✅ Full deployment complete!"
        echo ""
        echo "=========================================="
        echo "🎉 CheeSense is ready!"
        echo "=========================================="
        echo "🌐 Dashboard: http://localhost:8085"
        echo "📊 InfluxDB UI: http://localhost:8086"
        echo ""
        check_influxdb_bucket
        ;;
    0)
        echo "Exiting..."
        exit 0
        ;;
    *)
        echo "Invalid choice!"
        exit 1
        ;;
esac

echo ""
