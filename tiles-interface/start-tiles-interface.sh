#!/bin/bash

if [ ! -f source-code ]
then
    git clone https://github.com/julianrojas87/tiles-interface.git source-code
    cd source-code
    git checkout icwe2023
    cd ..
fi

cd source-code
sudo docker-compose --compatibility up --build -d