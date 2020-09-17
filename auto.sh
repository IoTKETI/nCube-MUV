#!/usr/bin/sh

pm2 start /home/pi/ETRI/node-mqtt-client-ncube-1.0.0/build/index.js
sleep 10
sudo chmod 777 /home/pi/nCube-MUV/
cd /home/pi/nCube-MUV
sudo chmod 777 *
pm2 start thyme.js

