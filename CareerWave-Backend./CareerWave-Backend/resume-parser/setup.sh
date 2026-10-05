#!/bin/bash

# Hecknex Resume Parser - Setup Script
# This script sets up the project for first-time use

echo "╔════════════════════════════════════════════════════════════╗"
echo "║   Hecknex Resume Parser - Setup & Installation             ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed"
    echo "   Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"
echo "✅ npm $(npm -v) detected"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo "✅ .env created from .env.example"
else
    echo "✅ .env file already exists"
fi

echo ""
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo ""
echo "✅ Installation complete!"
echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║   Next Steps                                               ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "1️⃣  Start the API server:"
echo "   npm start"
echo ""
echo "2️⃣  In another terminal, parse a resume:"
echo "   npm run parse your-resume.pdf"
echo ""
echo "3️⃣  Or use the REST API:"
echo "   curl -X POST -F \"file=@resume.pdf\" http://localhost:3000/api/parse"
echo ""
echo "📚 Documentation:"
echo "   - README.md       — Full documentation"
echo "   - QUICKSTART.md   — 5-minute quick start"
echo "   - DEPLOYMENT.md   — Deploy to production"
echo "   - examples.js     — Code examples"
echo ""
echo "💡 First run checklist:"
echo "   ☐ npm start          (Start API server)"
echo "   ☐ Test with a resume (npm run parse)"
echo "   ☐ Read the docs      (README.md)"
echo "   ☐ Deploy to prod     (DEPLOYMENT.md)"
echo ""
echo "🚀 Happy parsing!"
