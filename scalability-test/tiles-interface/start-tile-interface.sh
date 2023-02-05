#!/bin/bash

git clone https://github.com/julianrojas87/tiles-interface.git source-code
cd source-code
git checkout icwe20223

sudo docker-compose up -d