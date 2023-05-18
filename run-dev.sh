#!/bin/sh

echo "If you add '-d' you can run the dev setup in detached mode!\n\n"

docker-compose -f docker-compose.yml -f docker-compose.dev.yml -f docker-compose.dev.build.yml up --build $@