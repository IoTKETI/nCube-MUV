#!/usr/bin/sh

sudo modprobe rndis_host
sudo modprobe usbserial vendor=0x1ECB product=0x0205

sudo chmod 777 /home/pi/nCube-MUV/
cd /home/pi/nCube-MUV
sudo chmod 777 *
pm2 start thyme.js

