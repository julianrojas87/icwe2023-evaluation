#!/bin/bash

# Download ERA KG
if [ ! -f data/era-kg-v2.5.0.nq.gz ]
then
    mkdir data
    cd data
    wget -O era-kg-v2.5.0.nq.gz https://cloud.ilabt.imec.be/index.php/s/dgrozb6BPyak5oP/download/era-kg-v2.5.0.nq.gz
    cd ..
fi

# Start Stardog Docker container
sudo docker pull stardog/stardog:latest
sudo docker run -it -v `pwd`/home:/var/opt/stardog -v `pwd`/data:/home --name stardog --user root -p 5820:5820 -e STARDOG_SERVER_JAVA_ARGS="-Xmx8g -Xms8g -XX:MaxDirectMemorySize=12g" -d stardog/stardog