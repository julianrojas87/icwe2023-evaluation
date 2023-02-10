#!/bin/bash

# Download ERA KG
if [ ! -f data/era-kg_04-02-2023.nt.gz ]
then
    mkdir data
    cd data
    wget -O era-kg_04-02-2023.nt.gz https://cloud.ilabt.imec.be/index.php/s/BMa4rdDoE4jKMq2/download/era-kg_04-02-2023.nt.gz
    cd ..
fi

# Start Stardog Docker container
sudo docker pull stardog/stardog:latest
sudo docker run -it -v `pwd`/home:/var/opt/stardog -v `pwd`/data:/home --name stardog -p 5820:5820 -e STARDOG_SERVER_JAVA_ARGS="-Xmx8g -Xms8g -XX:MaxDirectMemorySize=12g" -d stardog/stardog