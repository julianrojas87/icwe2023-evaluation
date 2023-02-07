#!/bin/bash

git clone https://github.com/julianrojas87/era2osm.git
cd era2osm
git checkout icwe2023

# era2osm requires the local Virtuoso instance to be up and running 
sudo docker build -t era2osm .
sudo docker run -p 3000:3000 --cpus="1" -d era2osm