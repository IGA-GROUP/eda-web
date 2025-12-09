#!/bin/bash
# QUICK START - Быстрый старт приложения FoodFlow

echo "🍕 FoodFlow - Приложение доставки еды"
echo "===================================="
echo ""

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Шаг 1: Проверка Python${NC}"
if command -v python3 &> /dev/null; then
    echo -e "${GREEN}✓ Python установлен$(python3 --version)${NC}"
else
    echo -e "${RED}✗ Python не найден. Пожалуйста, установите Python 3.8+${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}Шаг 2: Установка зависимостей Backend${NC}"
cd backend
if [ -f requirements.txt ]; then
    pip install -r requirements.txt
    echo -e "${GREEN}✓ Зависимости установлены${NC}"
else
    echo -e "${RED}✗ requirements.txt не найден${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}Шаг 3: Инициализация БД${NC}"
python app.py &
sleep 2
kill $!
echo -e "${GREEN}✓ База данных инициализирована${NC}"

echo ""
echo -e "${YELLOW}Шаг 4: Запуск Backend${NC}"
echo -e "${GREEN}Backend запущен на http://localhost:5000${NC}"
python app.py &
BACKEND_PID=$!

echo ""
echo -e "${YELLOW}Шаг 5: Frontend${NC}"
echo -e "${GREEN}Откройте frontend/index.html в браузере${NC}"

echo ""
echo -e "${GREEN}✓ Все готово!${NC}"
echo ""
echo "Frontend: файл frontend/index.html"
echo "Backend: http://localhost:5000"
echo ""
echo "Для остановки Backend нажмите Ctrl+C"

wait $BACKEND_PID
