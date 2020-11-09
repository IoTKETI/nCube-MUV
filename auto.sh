#!/usr/bin/sh

wget http://repo.mosquitto.org/debian/mosquitto-repo.gpg.key
sudo apt-key add mosquitto-repo.gpg.key
cd /etc/apt/sources.list.d/
sudo wget http://repo.mosquitto.org/debian/mosquitto-buster.list 
sudo apt-get update
sudo apt-get install -y mosquitto

pip3 install paho-mqtt

sudo chmod 777 /home/pi/nCube-MUV/
cd /home/pi/nCube-MUV
sudo chmod 777 *
pm2 start thyme.js

