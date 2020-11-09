/**
 * Created by Il Yeup, Ahn in KETI on 2017-02-25.
 */

/**
 * Copyright (c) 2018, OCEAN
 * All rights reserved.
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * 1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * 3. The name of the author may not be used to endorse or promote products derived from this software without specific prior written permission.
 * THIS SOFTWARE IS PROVIDED BY THE AUTHOR ``AS IS'' AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

    // for TAS
var net = require('net');
var ip = require('ip');
var moment = require('moment');

var mavlink = require('./mavlibrary/mavlink.js');
var fs = require('fs');

/*
// I2C
var bus = 3;
var i2c = require('i2c-bus'),
    i2cBus = i2c.openSync(bus),
    oled = require('oled-i2c-bus');
var font = require('oled-font-5x7');
var sleep = require('system-sleep');
const SIZE_X=128,
      SIZE_Y=32;
var opts = {
  width: SIZE_X,
  height: SIZE_Y,
  address: 0x3c
};
try {
  var oled = new oled(i2cBus, opts);
  oled.clearDisplay();
  oled.turnOnDisplay();
}
catch(err) {
  // Print an error message and terminate the application
  console.log(err.message);
  process.exit(1);
}
*/
var _server = null;

var socket_mav = null;
var mavPort = null;
var ltePort = null;

var mavPortNum = '/dev/ttyAMA0';
var mavBaudrate = '57600';
var ltePortNum = '/dev/ttyUSB1';
var lteBaudrate = '115200';

var ae_name = {};
ae_name = JSON.parse(fs.readFileSync('flight.json', 'utf8'));
var cnt_name = '';
//oled.setCursor(0,10);
//oled.writeString(font, 1, 'Start thyme_tas_mav', 1, false);
//displayMsg('Start thyme_tas_mav.js');

exports.ready = function tas_ready() {
    cnt_name = my_cnt_name.split('/')[4]
//    oled.clearDisplay();
//    oled.setCursor(0,0);
//    oled.writeString(font, 1, my_drone_type, 1, true);
    //displayMsg('Drone Type:' + my_drone_type);
    if(my_drone_type === 'dji') {
        if (_server == null) {
            _server = net.createServer(function (socket) {
                console.log('socket connected');
//                oled.setCursor(36,0);
//                oled.writeString(font, 1, mavPortNum.substring(4,12) + '/115200', 1, false);
                //displayMsg('DJI Port Open:' + mavPortNum + ', 115200');
                socket.id = Math.random() * 1000;

                socket.on('data', dji_handler);

                socket.on('end', function () {
                    console.log('end');
                    //displayMsg('DJI Port End.');
                });

                socket.on('close', function () {
                    console.log('close');
                    //displayMsg('DJI Port Closed.');

                    // setTimeout(dji_sdk_launch, 1000);
                });

                socket.on('error', function (e) {
                    console.log('error ', e);
                    //displayMsg('DJI Port Error: ' + e);
                });
            });

            _server.listen(conf.ae.tas_mav_port, function () {
                console.log('TCP Server (' + ip.address() + ') for TAS is listening on port ' + conf.ae.tas_mav_port);
                //displayMsg('TCP Server is listening...');
                // setTimeout(dji_sdk_launch, 1500);
            });
        }
    }
    else if(my_drone_type === 'pixhawk') {
        mavPortNum = '/dev/ttyAMA0';
        mavBaudrate = '57600';
        mavPortOpening();
    }
    else {

    }

    ltePortNum = '/dev/ttyUSB1';
    lteBaudrate = '115200';
    ltePortOpening();
};

// var spawn = require('child_process').spawn;
// var djiosdk = null;
//
// function dji_sdk_launch() {
//     djiosdk = spawn('./djiosdk-Mobius', ['UserConfig.txt']);
//
//     djiosdk.stdout.on('data', function(data) {
//         console.log('stdout: ' + data);
//     });
//
//     djiosdk.stderr.on('data', function(data) {
//         console.log('stderr: ' + data);
//
//         //setTimeout(dji_sdk_launch, 1500);
//     });
//
//     djiosdk.on('exit', function(code) {
//         console.log('exit: ' + code);
//
//         setTimeout(dji_sdk_launch, 1000);
//     });
//
//     djiosdk.on('error', function(code) {
//         console.log('error: ' + code);
//
//         //setTimeout(dji_sdk_launch, 1000);
//     });
// }


var aggr_content = {};

function send_aggr_to_Mobius(topic, content_each, gap) {
    if(aggr_content.hasOwnProperty(topic)) {
        var timestamp = moment().format('YYYY-MM-DDTHH:mm:ssSSS');
        aggr_content[topic][timestamp] = content_each;
    }
    else {
        aggr_content[topic] = {};
        timestamp = moment().format('YYYY-MM-DDTHH:mm:ssSSS');
        aggr_content[topic][timestamp] = content_each;

        setTimeout(function () {
            sh_adn.crtci(topic+'?rcn=0', 0, aggr_content[topic], null, function () {
//                oled.setCursor(0,10);
//                oled.writeString(font, 1, '                     ', 1, true);
//                oled.setCursor(0,10);
//                oled.writeString(font, 1, 'Send to /'+topic.split('/')[4]+'/', 1, false);
                //displayMsg('Send Drone Data..');
            });

            delete aggr_content[topic];
        }, gap, topic);
    }
}

function mavlinkGenerateMessage(sysId, type, params) {
    const mavlinkParser = new MAVLink(null/*logger*/, sysId, 0);
    try {
        var mavMsg = null;
        var genMsg = null;
        //var targetSysId = sysId;
        var targetCompId = (params.targetCompId == undefined)?
            0:
            params.targetCompId;

        switch( type ) {
            // MESSAGE ////////////////////////////////////
            case mavlink.MAVLINK_MSG_ID_PING:
                mavMsg = new mavlink.messages.ping(params.time_usec, params.seq, params.target_system, params.target_component);
                break;
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
            case mavlink.MAVLINK_MSG_ID_SYS_STATUS:
                mavMsg = new mavlink.messages.sys_status(params.onboard_control_sensors_present,
                    params.onboard_control_sensors_enabled,
                    params.onboard_control_sensors_health,
                    params.load,
                    params.voltage_battery,
                    params.current_battery,
                    params.battery_remaining,
                    params.drop_rate_comm,
                    params.errors_comm,
                    params.errors_count1,
                    params.errors_count2,
                    params.errors_count3,
                    params.errors_count4);
                break;
        }
    }
    catch( e ) {
        console.log( 'MAVLINK EX:' + e );
    }

    if (mavMsg) {
        genMsg = Buffer.from(mavMsg.pack(mavlinkParser));
        //console.log('>>>>> MAVLINK OUTGOING MSG: ' + genMsg.toString('hex'));
    }

    return genMsg;
}

function sendDroneMessage(type, params) {
    try {
        var msg = mavlinkGenerateMessage(my_system_id, type, params);
        if (msg == null) {
            console.log("mavlink message is null");
        }
        else {
            // console.log('msg: ', msg);
            // console.log('msg_seq : ', msg.slice(2,3));
            //mqtt_client.publish(my_cnt_name, msg.toString('hex'));
            //_this.send_aggr_to_Mobius(my_cnt_name, msg.toString('hex'), 1500);
            mavPortData(msg);
        }
    }
    catch( ex ) {
        console.log( '[ERROR] ' + ex );
    }
}

var dji = {};
var params = {};

function dji_handler(data) {
    socket_mav = this;
    
    var data_arr = data.toString().split(',');

    dji.flightstatus = data_arr[0].replace('[', '');
    dji.timestamp = data_arr[1].slice(1, data_arr[1].length);
    dji.lat = data_arr[2];
    dji.lon = data_arr[3];
    dji.alt = data_arr[4];
    dji.relative_alt = data_arr[5];
    dji.roll = data_arr[6];
    dji.pitch = data_arr[7];
    dji.yaw = data_arr[8];
    dji.vx = data_arr[9];
    dji.vy = data_arr[10];
    dji.vz = data_arr[11];
    dji.bat_percentage = data_arr[12];
    dji.bat_voltage = data_arr[13];
    dji.bat_current = data_arr[14];
    dji.bat_capacity = data_arr[15].replace(']', '');

    // Debug
    var debug_string = dji.lat + ', ' + dji.lon + ', ' + dji.alt + ', ' + dji.relative_alt;
    mqtt_client.publish(my_parent_cnt_name + '/Debug', debug_string);

    // #0 PING
    params.time_usec = dji.timestamp;
    params.seq = 0;
    params.target_system = 0;
    params.target_component = 0;
    setTimeout(sendDroneMessage, 1, mavlink.MAVLINK_MSG_ID_PING, params);

    // #1 HEARTBEAT
    params.type = 2;
    params.autopilot = 3;

    if(dji.flightstatus == '0') {
        params.base_mode = 81;
    }
    else {
        params.base_mode = (81 | 0x80);
    }

    params.system_status = 4;
    params.mavlink_version = 3;
    setTimeout(sendDroneMessage, 1, mavlink.MAVLINK_MSG_ID_HEARTBEAT, params);

    // #2 MAVLINK_MSG_ID_GPS_RAW_INT
    params.time_usec = dji.timestamp;
    params.fix_type = 3;
    params.lat = parseFloat(dji.lat) * 1E7;
    params.lon = parseFloat(dji.lon) * 1E7;
    params.alt = parseFloat(dji.alt) * 1000;
    params.eph = 175;
    params.epv = 270;
    params.vel = 7;
    params.cog = 0;
    params.satellites_visible = 7;
    params.alt_ellipsoid = 0;
    params.h_acc = 0;
    params.v_acc = 0;
    params.vel_acc = 0;
    params.hdg_acc = 0;
    setTimeout(sendDroneMessage, 1, mavlink.MAVLINK_MSG_ID_GPS_RAW_INT, params);

    // #3 MAVLINK_MSG_ID_ATTITUDE
    params.time_boot_ms = dji.timestamp;
    params.roll = dji.roll;
    params.pitch = dji.pitch;
    params.yaw = dji.yaw;
    params.rollspeed = -0.00011268721573287621;
    params.pitchspeed = 0.0000612109579378739;
    params.yawspeed = -0.00031687552109360695;
    setTimeout(sendDroneMessage, 1, mavlink.MAVLINK_MSG_ID_ATTITUDE, params);

    // #4 MAVLINK_MSG_ID_GLOBAL_POSITION_INT
    params.time_boot_ms = dji.timestamp;
    params.lat = parseFloat(dji.lat) * 1E7;
    params.lon = parseFloat(dji.lon) * 1E7;
    params.alt = parseFloat(dji.alt) * 1000;
    params.relative_alt = parseFloat(dji.relative_alt) * 1000;
    params.vx = parseFloat(dji.vx) * 100;
    params.vy = parseFloat(dji.vy) * 100;
    params.vz = parseFloat(dji.vz) * 100;
    params.hdg = 0;
    setTimeout(sendDroneMessage, 1, mavlink.MAVLINK_MSG_ID_GLOBAL_POSITION_INT, params);

    // #5 MAVLINK_SYS_STATUS(#1)
    params.onboard_control_sensors_present = mavlink.MAV_SYS_STATUS_SENSOR_3D_GYRO & mavlink.MAV_SYS_STATUS_SENSOR_GPS;
    params.onboard_control_sensors_enabled = mavlink.MAV_SYS_STATUS_SENSOR_3D_GYRO & mavlink.MAV_SYS_STATUS_SENSOR_GPS;
    params.onboard_control_sensors_health = mavlink.MAV_SYS_STATUS_SENSOR_3D_GYRO & mavlink.MAV_SYS_STATUS_SENSOR_GPS;
    params.load = 500;
    params.voltage_battery = dji.bat_voltage;
    params.current_battery = dji.bat_current;
    params.battery_remaining = dji.bat_percentagea;
    params.drop_rate_comm = 8;
    params.errors_comm = 0;
    params.errors_count1 = 0;
    params.errors_count2 = 0;
    params.errors_count3 = 0;
    params.errors_count4 = 0;
    setTimeout(sendDroneMessage, 1, mavlink.MAVLINK_MSG_ID_SYS_STATUS, params);
}

exports.noti = function (path_arr, cinObj, socket) {
    var cin = {};
    cin.ctname = path_arr[path_arr.length - 2];
    cin.con = (cinObj.con != null) ? cinObj.con : cinObj.content;

    if (cin.con == '') {
        console.log('---- is not cin message');
    }
    else {
        socket.write(JSON.stringify(cin));
    }
};

exports.gcs_noti_handler = function (message) {
    if(my_drone_type === 'dji') {
        var com_msg = message.toString();
        var com_message = com_msg.split(":");
        var msg_command = com_message[0];

        if (msg_command == 't' || msg_command == 'h' || msg_command == 'l') {
            socket_mav.write(message);
        }
        else if (msg_command == 'g') {
            if(com_message.length < 5) {
                for(var i = 0; i < (5-com_message.length); i++) {
                    com_msg += ':0';
                }
                message = Buffer.from(com_msg);
            }
            socket_mav.write(message);

            var msg_lat = com_message[1].substring(0,7);
            var msg_lon = com_message[2].substring(0,7);
            var msg_alt = com_message[3].substring(0,3);
        }
        else if (msg_command == 'm'|| msg_command == 'a') {
            socket_mav.write(message);
        }
    }
    else if(my_drone_type === 'pixhawk') {
        if (mavPort != null) {
            if (mavPort.isOpen) {
                mavPort.write(message);
            }
        }
    }
    else {

    }
};

var SerialPort = require('serialport');

function mavPortOpening() {
    if (mavPort == null) {
        mavPort = new SerialPort(mavPortNum, {
            baudRate: parseInt(mavBaudrate, 10),
        });

        mavPort.on('open', mavPortOpen);
        mavPort.on('close', mavPortClose);
        mavPort.on('error', mavPortError);
        mavPort.on('data', mavPortData);
    }
    else {
        if (mavPort.isOpen) {

        }
        else {
            mavPort.open();
        }
    }
}

function mavPortOpen() {
    console.log('mavPort open. ' + mavPortNum + ' Data rate: ' + mavBaudrate);
}

function mavPortClose() {
    console.log('mavPort closed.');

    setTimeout(mavPortOpening, 2000);
}

function mavPortError(error) {
    var error_str = error.toString();
    console.log('[mavPort error]: ' + error.message);
    if (error_str.substring(0, 14) == "Error: Opening") {

    }
    else {
        console.log('mavPort error : ' + error);
    }

    setTimeout(mavPortOpening, 2000);
}

global.mav_ver = 1;

const byteToHex = [];

for (let n = 0; n <= 0xff; ++n)
{
    const hexOctet = n.toString(16).padStart(2, "0");
    byteToHex.push(hexOctet);
}

function hex(arrayBuffer)
{
    const buff = new Uint8Array(arrayBuffer);
    const hexOctets = []; // new Array(buff.length) is even faster (preallocates necessary array size), then use hexOctets[i] instead of .push()

    for (let i = 0; i < buff.length; ++i)
        hexOctets.push(byteToHex[buff[i]]);

    return hexOctets.join("");
}

function extractMav(fnParse) {
    while(mavStr.length > 12) {
        var stx = mavStr.substr(0, 2);
        if(stx === 'fe') {
            if (stx === 'fe') {
                var len = parseInt(mavStr.substr(2, 2), 16);
                var mavLength = (6 * 2) + (len * 2) + (2 * 2);
            }
            else { // if (stx === 'fd') {
                len = parseInt(mavStr.substr(2, 2), 16);
                mavLength = (10 * 2) + (len * 2) + (2 * 2);
            }

            if (mavStr.length >= mavLength) {
                var mavPacket = mavStr.substr(0, mavLength);
                mavStr = mavStr.substr(mavLength);
                setTimeout(fnParse, 0, mavPacket);
            } 
            else {
                break;
            }
        }
        else {
            mavStr = mavStr.substr(2);
        }
    }
}

var mavStr = '';
function mavPortData(data) {
    mavStr += hex(data);

    while(mavStr.length > 12) {
        var stx = mavStr.substr(0, 2);
        if(stx === 'fe') {
            if (stx === 'fe') {
                var len = parseInt(mavStr.substr(2, 2), 16);
                var mavLength = (6 * 2) + (len * 2) + (2 * 2);
            }
            else { // if (stx === 'fd') {
                len = parseInt(mavStr.substr(2, 2), 16);
                mavLength = (10 * 2) + (len * 2) + (2 * 2);
            }

            if (mavStr.length >= mavLength) {
                var mavPacket = mavStr.substr(0, mavLength);
                mavStr = mavStr.substr(mavLength);
                setTimeout(parseMav, 0, mavPacket);
            }
            else {
                break;
            }
        }
        else {
            mavStr = mavStr.substr(2);
        }
    }
}
//
// var pre_seq = 0;
// function mavPortData(data) {
//     mavStr += data.toString('hex');
//     if(data[0] == 0xfe || data[0] == 0xfd) {
//         var mavStrArr = [];
//
//         var str = '';
//         var split_idx = 0;
//
//         mavStrArr[split_idx] = str;
//         for (var i = 0; i < mavStr.length; i+=2) {
//             str = mavStr.substr(i, 2);
//
//             if(mav_ver == 1) {
//                 if (str == 'fe') {
//                     mavStrArr[++split_idx] = '';
//                 }
//             }
//             else if(mav_ver == 2) {
//                 if (str == 'fd') {
//                     mavStrArr[++split_idx] = '';
//                 }
//             }
//
//             mavStrArr[split_idx] += str;
//         }
//         mavStrArr.splice(0, 1);
//
//         var mavPacket = '';
//         for (var idx in mavStrArr) {
//             if(mavStrArr.hasOwnProperty(idx)) {
//                 mavPacket = mavStrPacket + mavStrArr[idx];
//
//                 if(mav_ver == 1) {
//                     var refLen = (parseInt(mavPacket.substr(2, 2), 16) + 8) * 2;
//                 }tty
//                 else if(mav_ver == 2) {
//                     refLen = (parseInt(mavPacket.substr(2, 2), 16) + 12) * 2;
//                 }
//
//                 if(refLen == mavPacket.length) {
//                     mqtt_client.publish(my_cnt_name, Buffer.from(mavPacket, 'hex'));
//                     send_aggr_to_Mobius(my_cnt_name, mavPacket, 1500);
//                     mavStrPacket = '';
//
//                     setTimeout(parseMav, 0, mavPacket);
//                 }
//                 else if(refLen < mavPacket.length) {
//                     mavStrPacket = '';
//                     //console.log('                        ' + mavStrArr[idx]);
//                 }
//                 else {
//                     mavStrPacket = mavPacket;
//                     //console.log('                ' + mavStrPacket.length + ' - ' + mavStrPacket);
//                 }
//             }
//         }
//
//         if(mavStrPacket != '') {
//             mavStr = mavStrPacket;
//             mavStrPacket = '';
//         }
//         else {
//             mavStr = '';
//         }
//     }
// }

var gpi = {};
gpi.GLOBAL_POSITION_INT = {};

var hb = {};
hb.HEARTBEAT = {};

var flag_base_mode = 0;

function parseMav(mavPacket) {
    var ver = mavPacket.substr(0, 2);
    if (ver == 'fd') {
        var sysid = mavPacket.substr(10, 2).toLowerCase();
        var msgid = mavPacket.substr(14, 6).toLowerCase();
    }
    else {
        sysid = mavPacket.substr(6, 2).toLowerCase();
        msgid = mavPacket.substr(10, 2).toLowerCase();
    }

    var sys_id = parseInt(sysid, 16);
    var msg_id = parseInt(msgid, 16);

    if (msg_id == mavlink.MAVLINK_MSG_ID_GLOBAL_POSITION_INT) {
        if(authResult == 'done') {
            if (secPort.isOpen) {
                var len = mavPacket.length/2;
                const tr_ch = new Uint8Array(5 + len);
                tr_ch[0] = 0x5a;
                tr_ch[1] = 0xa5;
                tr_ch[2] = 0xf7;
                tr_ch[3] = (len / 256);
                tr_ch[4] = (len % 256);

                for (var idx = 0; idx < len; idx++) {
                    tr_ch[5 + idx] = parseInt(mavPacket.substr(idx*2, 2), 16);
                }

                const message = Buffer.from(tr_ch.buffer);
                secPort.write(message);
            }
        }

        if (ver == 'fd') {
            var base_offset = 20;
            var time_boot_ms = mavPacket.substr(base_offset, 8).toLowerCase();
            base_offset += 8;
            var lat = mavPacket.substr(base_offset, 8).toLowerCase();
            base_offset += 8;
            var lon = mavPacket.substr(base_offset, 8).toLowerCase();
            base_offset += 8;
            var alt = mavPacket.substr(base_offset, 8).toLowerCase();
            base_offset += 8;
            var relative_alt = mavPacket.substr(base_offset, 8).toLowerCase();
        }
        else {
            base_offset = 12;
            time_boot_ms = mavPacket.substr(base_offset, 8).toLowerCase();
            base_offset += 8;
            lat = mavPacket.substr(base_offset, 8).toLowerCase();
            base_offset += 8;
            lon = mavPacket.substr(base_offset, 8).toLowerCase();
            base_offset += 8;
            alt = mavPacket.substr(base_offset, 8).toLowerCase();
            base_offset += 8;
            relative_alt = mavPacket.substr(base_offset, 8).toLowerCase();
        }
        
        gpi.GLOBAL_POSITION_INT.time_boot_ms = Buffer.from(time_boot_ms, 'hex').readUInt32LE(0);
        gpi.GLOBAL_POSITION_INT.lat = Buffer.from(lat, 'hex').readInt32LE(0);
        gpi.GLOBAL_POSITION_INT.lon = Buffer.from(lon, 'hex').readInt32LE(0);
        gpi.GLOBAL_POSITION_INT.alt = Buffer.from(alt, 'hex').readInt32LE(0);
        gpi.GLOBAL_POSITION_INT.relative_alt = Buffer.from(relative_alt, 'hex').readInt32LE(0);

        //console.log(gpi);
    }

    else if (msg_id == mavlink.MAVLINK_MSG_ID_COMMAND_LONG) { // #76 : COMMAND_LONG
        // if(authResult == 'done') {
        //     if (secPort.isOpen) {
        //         len = parseInt(mavPacket.substr(2, 2), 16);
        //         const tr_ch = new Uint8Array(5 + len);
        //         tr_ch[0] = 0x5a;
        //         tr_ch[1] = 0xa5;
        //         tr_ch[2] = 0xf7;
        //         tr_ch[3] = (len / 256);
        //         tr_ch[4] = (len % 256);
        //
        //         for (idx = 0; idx < len; idx++) {
        //             tr_ch[5 + idx] = parseInt(mavPacket.substr((10 + idx) * 2, 2), 16);
        //         }
        //
        //         const message = Buffer.from(tr_ch.buffer);
        //         secPort.write(message);
        //     }
        // }
    }

    else if (msg_id == mavlink.MAVLINK_MSG_ID_HEARTBEAT) { // #00 : HEARTBEAT
        if(authResult == 'done') {
            if (secPort.isOpen) {
                len = mavPacket.length/2;
                const tr_ch = new Uint8Array(5 + len);
                tr_ch[0] = 0x5a;
                tr_ch[1] = 0xa5;
                tr_ch[2] = 0xf9;
                tr_ch[3] = (len / 256);
                tr_ch[4] = (len % 256);

                for (idx = 0; idx < len; idx++) {
                    tr_ch[5 + idx] = parseInt(mavPacket.substr(idx*2, 2), 16);
                }

                const message = Buffer.from(tr_ch.buffer);
                secPort.write(message);
            }
        }

        if (ver == 'fd') {
            base_offset = 20;
            var custom_mode = mavPacket.substr(base_offset, 8).toLowerCase();
            base_offset += 8;
            var type = mavPacket.substr(base_offset, 2).toLowerCase();
            base_offset += 2;
            var autopilot = mavPacket.substr(base_offset, 2).toLowerCase();
            base_offset += 2;
            var base_mode = mavPacket.substr(base_offset, 2).toLowerCase();
            base_offset += 2;
            var system_status = mavPacket.substr(base_offset, 2).toLowerCase();
            base_offset += 2;
            var mavlink_version = mavPacket.substr(base_offset, 2).toLowerCase();
        }
        else {
            base_offset = 12;
            custom_mode = mavPacket.substr(base_offset, 8).toLowerCase();
            base_offset += 8;
            type = mavPacket.substr(base_offset, 2).toLowerCase();
            base_offset += 2;
            autopilot = mavPacket.substr(base_offset, 2).toLowerCase();
            base_offset += 2;
            base_mode = mavPacket.substr(base_offset, 2).toLowerCase();
            base_offset += 2;
            system_status = mavPacket.substr(base_offset, 2).toLowerCase();
            base_offset += 2;
            mavlink_version = mavPacket.substr(base_offset, 2).toLowerCase();
        }

        hb.HEARTBEAT.type = Buffer.from(type, 'hex').readUInt8(0);
        hb.HEARTBEAT.autopilot = Buffer.from(autopilot, 'hex').readUInt8(0);
        hb.HEARTBEAT.base_mode = Buffer.from(base_mode, 'hex').readUInt8(0);
        hb.HEARTBEAT.custom_mode = Buffer.from(custom_mode, 'hex').readUInt32LE(0);
        hb.HEARTBEAT.system_status = Buffer.from(system_status, 'hex').readUInt8(0);
        hb.HEARTBEAT.mavlink_version = Buffer.from(mavlink_version, 'hex').readUInt8(0);

        if(hb.HEARTBEAT.base_mode & 0x80) { 
            if(flag_base_mode == 0) {
                flag_base_mode = 1;

                my_sortie_name = moment().format('YYYY_MM_DD_T_HH_mm');
                my_cnt_name = my_parent_cnt_name + '/' + my_sortie_name;
                sh_adn.crtct(my_parent_cnt_name+'?rcn=0', my_sortie_name, 0, function (rsc, res_body, count) {
                });

                lte_mission_name = lte_parent_mission_name + '/' + my_sortie_name;
                sh_adn.crtct(lte_parent_mission_name+'?rcn=0', my_sortie_name, 0, function (rsc, res_body, count) {
                });
            }
        }
        else {
            flag_base_mode = 0;
            my_sortie_name = 'disarm';
            my_cnt_name = my_parent_cnt_name + '/' + my_sortie_name;
            // sh_adn.crtct(my_parent_cnt_name+'?rcn=0', my_sortie_name, 0, function (rsc, res_body, count) {
            // });

            lte_mission_name = lte_parent_mission_name + '/' + my_sortie_name;
            // sh_adn.crtct(lte_parent_mission_name+'?rcn=0', my_sortie_name, 0, function (rsc, res_body, count) {
            // });
        }

        //console.log(hb);
    }
}

function ltePortOpening() {
    if (ltePort == null) {
        ltePort = new SerialPort(ltePortNum, {
            baudRate: parseInt(lteBaudrate, 10)
        });

        ltePort.on('open', ltePortOpen);
        ltePort.on('close', ltePortClose);
        ltePort.on('error', ltePortError);
        ltePort.on('data', ltePortData);
    }
    else {
        if (ltePort.isOpen) {

        }
        else {
            ltePort.open();
        }
    }
}

function ltePortOpen() {
    console.log('ltePort open. ' + ltePortNum + ' Data rate: ' + lteBaudrate);
    //displayMsg('LTE Port(' + ltePortNum + ') Open\n' + 'Data Rate: ' + lteBaudrate);

    setInterval(lteReqGetRssi, 2000);
}

function ltePortClose() {
    console.log('ltePort closed.');
	// displayMsg('LTE Port Closed');
    setTimeout(ltePortOpening, 2000);
}

function ltePortError(error) {
    var error_str = error.toString();
    console.log('[ltePort error]: ' + error.message);
    // displayMsg('[ltePort error]: ' + error.message);
    if (error_str.substring(0, 14) == "Error: Opening") {

    }
    else {
        console.log('[ltePort error]: ' + error);
    }

    setTimeout(ltePortOpening, 2000);
}

function lteReqGetRssi() {
    if(ltePort != null) {
        if (ltePort.isOpen) {
            //var message = Buffer.from('AT+CSQ\r');
            var message = Buffer.from('AT@DBG\r');
            ltePort.write(message);
        }
    }
}

var count = 0;
var strRssi = '';

function ltePortData(data) {
    strRssi += data.toString();

    //console.log(strRssi);

    var arrRssi = strRssi.split('OK');

    if(arrRssi.length >= 2) {
        //console.log(arrRssi);

        var strLteQ = arrRssi[0].replace(/ /g, '');
        var arrLteQ = strLteQ.split(',');

        for(var idx in arrLteQ) {
            if(arrLteQ.hasOwnProperty(idx)) {
                //console.log(arrLteQ[idx]);
                var arrQValue = arrLteQ[idx].split(':');
                if(arrQValue[0] == '@DBG') {
                    gpi.GLOBAL_POSITION_INT.plmn = arrQValue[2];
                }
                else if(arrQValue[0] == 'Band') {
                    gpi.GLOBAL_POSITION_INT.band = parseInt(arrQValue[1]);
                }
                else if(arrQValue[0] == 'EARFCN') {
                    gpi.GLOBAL_POSITION_INT.earfcn = parseInt(arrQValue[1]);
                }
                else if(arrQValue[0] == 'Bandwidth') {
                    gpi.GLOBAL_POSITION_INT.bandwidth = parseInt(arrQValue[1].replace('MHz', ''));
                }
                else if(arrQValue[0] == 'PCI') {
                    gpi.GLOBAL_POSITION_INT.pci = parseInt(arrQValue[1]);
                }
                else if(arrQValue[0] == 'Cell-ID') {
                    gpi.GLOBAL_POSITION_INT.cell_id = arrQValue[1];
                }
                else if(arrQValue[0] == 'GUTI') {
                    gpi.GLOBAL_POSITION_INT.guti = arrQValue[1];
                }
                else if(arrQValue[0] == 'TAC') {
                    gpi.GLOBAL_POSITION_INT.tac = parseInt(arrQValue[1]);
                }
                else if(arrQValue[0] == 'RSRP') {
                    gpi.GLOBAL_POSITION_INT.rsrp = parseFloat(arrQValue[1].replace('dbm', ''));
                }
                else if(arrQValue[0] == 'RSRQ') {
                    gpi.GLOBAL_POSITION_INT.rsrq = parseFloat(arrQValue[1].replace('dbm', ''));
                }
                else if(arrQValue[0] == 'RSSI') {
                    gpi.GLOBAL_POSITION_INT.rssi = parseFloat(arrQValue[1].replace('dbm', ''));
                }
                else if(arrQValue[0] == 'SINR') {
                    gpi.GLOBAL_POSITION_INT.sinr = parseFloat(arrQValue[1].replace('db', ''));
                }
            }
        }

        //console.log(gpi);

        setTimeout(sendLteRssi, 0, gpi);

        strRssi = '';
    }
}

function sendLteRssi(gpi) {
    var parent = lte_mission_name+'?rcn=0';
    sh_adn.crtci(parent, 0, gpi, null, function () {

    });
}

// function displayMsg(msg) {
// 	// oled.clearDisplay();
//     oled.setCursor(1, 0);
//     var message = ('IP:' + ip.address() + '\n' + ae_name.flight + ',' + cnt_name + '\n' + msg);
// 	oled.writeString(font, 1, message, 1, true);
//     sleep(1000);
//     oled.clearDisplay();
// }
