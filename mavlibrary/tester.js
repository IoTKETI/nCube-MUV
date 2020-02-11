"use strict";


const mavlink = require('./mavlink');
const mavlinkMqttChannel = require('../server/lib/mavlink.mqtt.channel')();
const onem2mClient = require('onem2m_client')();
const droneModel = require('../server/models/drone.model');
const userModel = require('../server/models/user.model');
const config = require('../config.json');
const mongo = require('../server/utils/mongodb');

var TARGET = 'KARI'; // KETI
var USE_UDP = false;


var PORT = 14550;
var HOST = '203.253.128.161'; //'127.0.0.1';

var dgram = require('dgram');
var client = dgram.createSocket('udp4');


const NUMBER_OF_DRONES = 5;
const NUMBER_OF_USERS = 2;

const AE_NAME_PREFIX = `${TARGET}_UTM_DEMO_`;
const DRONE_ID_PREFIX = `${TARGET}_SimulationDrone`;
const FC_NAME_PREFIX = `${TARGET}_FC`;

const BASE_POSITION = {lat: 37.385783, lng: 127.125235};


// connect to MongoDB
mongo.connect(config[`${TARGET}`], (err, res) => {
  if(err){
    LOGGER.error(err);
  }
  console.log("[Virtual Drones] Local DataBase Connected!");
});

var TEST_GEN_MAVLINK_SYSTEM_ID = 150;
const mavlinkParser = new MAVLink(null/*logger*/, TEST_GEN_MAVLINK_SYSTEM_ID, 0);


function _padding(num, length) {
    var ret = '0000000000000000000' + num;
    return ret.substr(ret.length - length);
}

function _randomFloat(min, max) {
    return Math.random() * (max-min) + min;
}

function _randomInt(min, max) {
    return parseInt(Math.random() * (max-min+1)) + min;
}

function _randomIndex(ary) {
    return _randomInt(0, ary.length-1);
}

function _randomInitialPosition(basePos) {
  var offsetA = -0.008;
  var offsetB = 0.008;

  var direction = direction ? direction : 0;

  var offsetX = _randomFloat(offsetA, offsetB);
  var offsetY = _randomFloat(offsetA, offsetB);

  return {
    lat: basePos.lat += offsetX,
    lng: basePos.lng += offsetY
  };
}

function _randomPosition(basePos, offset, direction) {
  var direction = direction ? direction : 0;

  var offsetWeight = _randomInt(2, 5);

  var offsetValue = _randomFloat(offset, offset*offsetWeight);

  var newDirection = _randomInt(0, 100);
  if(newDirection < 8)
    newDirection = (direction == 0) ? 7 : direction - 1;
  else if(newDirection > 95)
    newDirection = (direction + 1) % 8;
  else 
    newDirection = direction;

  var result = {
    direction: newDirection,
    position: {
      lat: basePos.lat,
      lng: basePos.lng
    }
  }


  switch(newDirection) {


    case 0:
        result.position.lat += offsetValue;
        break;
    case 1:
        result.position.lat += offsetValue;
        result.position.lng += offsetValue;
        break;
    case 2:
        result.position.lng += offsetValue;
        break;

    
    case 3:
        result.position.lat -= offsetValue;
        result.position.lng += offsetValue;
        break;

    case 4:
        result.position.lat -= offsetValue;
        break;

    case 5:
        result.position.lat -= offsetValue;
        result.position.lng -= offsetValue;
        break;

    case 6:
        result.position.lng -= offsetValue;
        break;

    case 7:
        result.position.lat += offsetValue;
        result.position.lng -= offsetValue;
        break;

  

        



    }

    console.log( 'DIRECTION: ', direction, newDirection, offset, offsetWeight, offsetValue/offset, (result.position.lat-basePos.lat)/offset, (result.position.lng-basePos.lng)/offset);



    return result;
}

// message generating
function mavlinkGenerateMessage(sysId, type, params) {
  try {
    var mavMsg = null;
    var genMsg = null;
    var targetSysId = sysId;
    var targetCompId = (params.targetCompId == undefined)?
                        0:
                        params.targetCompId;

    switch( type ) {
      // MESSAGE ////////////////////////////////////
      case mavlink.MAVLINK_MSG_ID_HEARTBEAT:
        mavMsg = new mavlink.messages.heartbeat(params.type,
                                                params.autopilot,
                                                params.base_mode,
                                                params.custom_mode,
                                                params.system_status,
                                                params.mavlink_version);
        break;
      case mavlink.MAVLINK_MSG_ID_GPS_RAW_INT:
        mavMsg = new mavlink.messages.gps_raw_int(params.time_usec,
                                                    params.fix_type,
                                                    params.lat,
                                                    params.lon,
                                                    params.alt,
                                                    params.eph,
                                                    params.epv,
                                                    params.vel,
                                                    params.cog,
                                                    params.satellites_visible,
                                                    params.alt_ellipsoid,
                                                    params.h_acc,
                                                    params.v_acc,
                                                    params.vel_acc,
                                                    params.hdg_acc);
        break;        
      case mavlink.MAVLINK_MSG_ID_ATTITUDE:
        mavMsg = new mavlink.messages.attitude(params.time_boot_ms,
                                                params.roll,
                                                params.pitch,
                                                params.yaw,
                                                params.rollspeed,
                                                params.pitchspeed,
                                                params.yawspeed);                                                
        break;
      case mavlink.MAVLINK_MSG_ID_GLOBAL_POSITION_INT:
        mavMsg = new mavlink.messages.global_position_int(params.time_boot_ms,
                                                            params.lat,
                                                            params.lon,
                                                            params.alt,
                                                            params.relative_alt,
                                                            params.vx,
                                                            params.vy,
                                                            params.vz,
                                                            params.hdg);
        break;
    }
  }
  catch( e ) {
    console.log( 'MAVLINK EX:' + e );
  }

  if (mavMsg) {
    genMsg = new Buffer(mavMsg.pack(mavlinkParser));
    //console.log('>>>>> MAVLINK OUTGOING MSG: ' + genMsg.toString('hex'));
  }

  return genMsg;
}


// mavlink 패킷으로 구성된 drone data를 MOBIUS를 통해 드론에 전달하는 내부함수
function sendDroneMessage(userAe, droneAe, droneName, droneSortie, sysId, type, params) {
  return new Promise((resolve, reject) => {
    try {
      var msg = mavlinkGenerateMessage(sysId, type, params);
      if (msg == null) {
        reject("mavlink message is null");
      }


      if(USE_UDP) {
        client.send(msg, 0, msg.length, PORT, HOST);
      }
      else {
        var mqttChannel = mavlinkMqttChannel.getChannelInstance(`mqtt://${HOST}`, userAe, droneAe, droneName, droneSortie);
        if(!mqttChannel)
          return resolve('cannot find mqtt channel');
        //mqttChannel.sendMessage(msg);      
        var genMavlinkDataTopic = util.format('/Mobius/%s/Drone_Data/%s/%s', droneAe, droneName, droneSortie);
        mqttChannel.MavlinkMqttChannel.publish(genMavlinkDataTopic, msg); //, function(r){console.log(r)});      
      }


      resolve();
    }
    catch( ex ) {
      console.log( '[ERROR] ' + ex );
      reject(ex);
    }
  });
}

function _createDroneInApproval(drone){
    return new Promise((resolve, reject) => {
  
      onem2mClient.Http.createResource(`http://${HOST}:7579/Mobius/SYNCTECHNO_TEST/approval`, {
        'm2m:cnt' : {
          rn : drone.droneId,
          lbl : null
        }
      }, 'SGCSTest')
      .then(res => {
        resolve();
      })
      .catch(err => {
        if(err.status == '409' || err.statusCode == '409'){
          resolve();
        }else{
          reject(err);
        }
      })
    })
}

function _createDroneInAe(drone){
  return new Promise((resolve, reject) => {

    onem2mClient.Http.createResource(`http://${HOST}:7579/Mobius/${drone.aeName}/Drone_Data`, {
      'm2m:cnt' : {
        rn : drone.fcName,
        lbl : null
      }
    }, 'SGCSTest')
    .then(res => {
      resolve();
    })
    .catch(err => {
      if(err.status == '409' || err.statusCode == '409'){
        resolve();
      }else{
        reject(err);
      }
    })
  })
}

function _createSortieInAe(drone){
  return new Promise((resolve, reject) => {

    onem2mClient.Http.createResource(`http://${HOST}:7579/Mobius/${drone.aeName}/Drone_Data/${drone.fcName}`, {
      'm2m:cnt' : {
        rn : drone.sortie,
        lbl : null
      }
    }, 'SGCSTest')
    .then(res => {
      resolve();
    })
    .catch(err => {
      if(err.status == '409' || err.statusCode == '409'){
        resolve();
      }else{
        reject(err);
      }
    })
  })
}

function _createDroneInLocalDB(userEmail, drone){
  return new Promise((resolve, reject) => {
    userModel.findOne({email : userEmail}, {_id : true}).exec()
    .then(uid => {  
      var query = {
        userId: uid._id,
        ae: drone.aeName,
        id: drone.droneId,
        name: drone.fcName
      };
      var upsertValue = {
        userId : uid._id,
        ae : drone.aeName, 
        id : drone.droneId,                
        name : drone.fcName,
        sortie : drone.sortie,
        sysId : drone.sysId
      }
  
      droneModel.findOneAndUpdate(
        query,
        upsertValue,
        { upsert: true, new: true, setDefaultsOnInsert: true }
      ).exec()
      .then((result)=>{
        resolve(result);              
      })
      .catch((err)=>{
        reject(err);
      })
    });
  })
}

function _createSortieInfo(drone){
    return new Promise((resolve, reject) => {
          
        _createDroneInApproval(drone)
        .then((res)=>{
            return  onem2mClient.Http.createResource(`http://${HOST}:7579/Mobius/SYNCTECHNO_TEST/approval/${drone.droneId}`, {
                "m2m:cin" : {
                    con : {
                    drone : drone.fcName,
                    gcs : drone.aeName,
                    sorties : drone.sortie
                    }
                }
                }, 'SGCSTest')
      })
      .then(res => {
        return _createDroneInAe(drone);
      })
      .then(res => {
        return _createSortieInAe(drone);
      })
      .then(res => {
        var userEmail = `demo01@${TARGET}.re.kr`;
        return _createDroneInLocalDB(userEmail.toLowerCase(), drone);
      })
      .then(res => {
        resolve(res);
      })
      .catch(err => {
        reject(err);
      })
    })
  }


var droneList = [];

var minlat=1000, minlng=1000, maxlat=-1, maxlng=-1;

var prevPosition = BASE_POSITION;
for(var i=0; i < NUMBER_OF_DRONES; i++) {
    var aeName = AE_NAME_PREFIX + _padding(i%2+1, 2);
    var fcName = FC_NAME_PREFIX + _padding(i+1, 4);
    var droneId = DRONE_ID_PREFIX + _padding(i+1, 4);
    var sysId = _randomInt(100,200);
    var sortie = '2019_22_33_T_33_55';

    var direction = _randomInt(0,3);
    var newPosition = _randomInitialPosition(prevPosition);
    var drone = {
      aeName: aeName,
      fcName: fcName,
      droneId: droneId,
      sysId: sysId,
      sortie: sortie,
      direction: direction,
      position: newPosition
    };

    minlat = Math.min(minlat, drone.position.lat);
    minlng = Math.min(minlng, drone.position.lng);
    maxlat = Math.max(maxlat, drone.position.lat);
    maxlng = Math.max(maxlng, drone.position.lng);

    droneList.push(drone);

    prevPosition = drone.position;
}


console.log( minlat, maxlat, maxlat-minlat, minlng, maxlng, maxlng-minlng);

//process.exit(0);

Promise.all(droneList.map((item)=>{
    return new Promise((resolve, reject)=>{
        _createSortieInfo(item)
        .then((res)=>{
            //console.log( 'SUCCESS', item.fcName );
            resolve(res);
        })
        .catch((err)=>{
            console.log( 'FAIL', item.fcName);

            reject(err);
        })

    })
}))
.then((res)=>{

    var time = 12228;
    setInterval(()=>{

        var params = new Object();
    
        for(var i=0; i < NUMBER_OF_DRONES; i++) {
            var drone = droneList[i];
    

            var newPosition = _randomPosition(drone.position, 0.00002, drone.direction);

            drone.position = newPosition.position;
            drone.direction = newPosition.direction;
            //console.log(drone.position);       
    
            //  generate and send mavlink data
            // #1 HEARTBEAT
            params.type = 2; params.autopilot = 3; params.base_mode = 81; params.system_status = 4; params.mavlink_version = 3;
            sendDroneMessage(drone.aeName, 
                                drone.aeName, 
                                drone.fcName, 
                                drone.sortie,
                                drone.sysId, 
                                mavlink.MAVLINK_MSG_ID_HEARTBEAT, 
                                params);
            // #2 MAVLINK_MSG_ID_GPS_RAW_INT
            params.time_usec = 0; params.fix_type = 3; params.lat = drone.position.lat * 1E7; params.lon = drone.position.lng * 1E7; params.alt = 81480;
            params.eph = 175; params.epv = 270; params.vel = 7; params.cog = 0; params.satellites_visible = 7; params.alt_ellipsoid = 0;
            params.h_acc = 0; params.v_acc = 0; params.vel_acc = 0; params.hdg_acc = 0;
            sendDroneMessage(drone.aeName, 
                                drone.aeName, 
                                drone.fcName, 
                                drone.sortie,
                                drone.sysId, 
                                mavlink.MAVLINK_MSG_ID_GPS_RAW_INT, 
                                params);
            // #3 MAVLINK_MSG_ID_ATTITUDE
            params.time_boot_ms = time; params.roll = _randomFloat(-3, 3); params.pitch = _randomFloat(-3, 3); params.yaw = _randomFloat(-3, 3); 
            params.rollspeed = -0.00011268721573287621; params.pitchspeed = 0.0000612109579378739; params.yawspeed = -0.00031687552109360695;
            sendDroneMessage(drone.aeName, 
                                drone.aeName, 
                                drone.fcName,
                                drone.sortie,
                                drone.sysId, 
                                mavlink.MAVLINK_MSG_ID_ATTITUDE, 
                                params);
            // #4 MAVLINK_MSG_ID_GLOBAL_POSITION_INT
            params.time_boot_ms = time; params.lat = drone.position.lat * 1E7; params.lon = drone.position.lng * 1E7; params.alt = -70;
            params.relative_alt = -73; params.vx = 0; params.vy = 0; params.vz = -11; params.hdg = drone.direction*45*1E2;
            sendDroneMessage(drone.aeName, 
                                drone.aeName, 
                                drone.fcName,
                                drone.sortie,
                                drone.sysId, 
                                mavlink.MAVLINK_MSG_ID_GLOBAL_POSITION_INT, 
                                params);
            //console.log( drone.fcName);

            time += 100;
        }
    
    
    }, 1000);
})
.catch((err)=>{
    console.log( "Error", err );
});



console.log( droneList);
