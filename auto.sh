#!/usr/bin/sh

sudo chmod 777 /home/ETRI/node-mqtt-client-ncube-1.0.0
npm run start
sleep 5
sudo chmod 777 /home/pi/nCube-MUV/
cd /home/pi/nCube-MUV
sudo chmod 777 *
pm2 start thyme.js

