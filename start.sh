#!/bin/bash
# Start FluxoCaixa Application

echo "🏗️  FluxoCaixa - Gestão Financeira de Obras"
echo "============================================"

# Start backend
echo "▶  Starting backend (port 3001)..."
cd "$(dirname "$0")"
node_modules/.bin/tsx backend/src/index.ts &
BACKEND_PID=$!

sleep 2

# Start frontend dev server
echo "▶  Starting frontend (port 5173)..."
cd frontend && ../node_modules/.bin/vite &
FRONTEND_PID=$!

echo ""
echo "✅ Application started!"
echo "   Frontend: http://localhost:5173"
echo "   Backend:  http://localhost:3001"
echo ""
echo "⚠  Se for o primeiro acesso, troque a senha do administrador imediatamente."
echo ""
echo "Press Ctrl+C to stop all services..."

# Wait and handle shutdown
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'Stopped.'" EXIT
wait
