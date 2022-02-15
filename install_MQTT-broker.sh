#!/usr/bin/sh

OS = $(cat /etc/*release* | grep -w PRETTY_NAME | cut -d '(' -f 2 | cut -d ')' -f 1)

if [ $OS = "bullseye" ];then
  wget http://repo.mosquitto.org/debian/mosquitto-repo.gpg.key
  sudo apt-key add mosquitto-repo.gpg.key
  cd /etc/apt/sources.list.d/
  sudo wget http://repo.mosquitto.org/debian/mosquitto-bullseye.list 
  sudo apt-get update
  sudo apt-get install -y mosquitto
else
  wget http://repo.mosquitto.org/debian/mosquitto-repo.gpg.key
  sudo apt-key add mosquitto-repo.gpg.key
  cd /etc/apt/sources.list.d/
  sudo wget http://repo.mosquitto.org/debian/mosquitto-buster.list 
  sudo apt-get update
  sudo apt-get install -y mosquitto
fi
