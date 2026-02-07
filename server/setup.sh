#!/bin/bash
set -e

echo "🚀 Setting up server..."

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Upgrade pip
pip install --upgrade pip

# Install requirements
pip install -r requirements.txt

echo "✅ Setup complete!"
echo ""
echo "To run the server:"
echo "  source server/venv/bin/activate"
echo "  python3 server/main.py"
