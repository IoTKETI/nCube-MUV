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
var fs = require('fs');
const {exec} = require('child_process');

var mavlink = require('./mavlibrary/mavlink.js');
var MAVLink20Processor = require('./mavlibrary/mavlink20.js');

var _server = null;

var socket_mav = null;
global.mavPort = null;

var mavPortNum = '/dev/ttyAMA0';
var mavBaudrate = '115200';

exports.ready = function tas_ready() {
    if (my_drone_type === 'dji') {
        if (_server == null) {
            _server = net.createServer(function (socket) {
                console.log('socket connected');
                socket.id = Math.random() * 1000;

                socket.on('data', dji_handler);

                socket.on('end', function () {
                    console.log('end');
                });

                socket.on('close', function () {
                    console.log('close');
                });

                socket.on('error', function (e) {
                    console.log('error ', e);
                });
            });

            _server.listen(conf.ae.tas_mav_port, function () {
                console.log('TCP Server (' + ip.address() + ') for TAS is listening on port ' + conf.ae.tas_mav_port);

                // setTimeout(dji_sdk_launch, 1500);
            });
        }
    } else if ((my_drone_type === 'pixhawk') || (my_drone_type === 'ardupilot') || (my_drone_type === 'px4')) {
        exec("cat /etc/*release* | grep -w ID | cut -d '=' -f 2", (error, stdout, stderr) => {
            if (error) {  // Windows
                console.log('OS is Windows');
                mavPortNum = 'COM4';
                mavBaudrate = '115200';
            }
            if (stdout === "raspbian\n") {  // CROW
                console.log('OS is Raspberry Pi');
                mavPortNum = '/dev/ttyAMA0';
                mavBaudrate = '115200';
            } else if (stdout === "ubuntu\n") {  // KEA
                console.log('OS is Ubuntu');
                mavPortNum = '/dev/ttyTHS0';
                mavBaudrate = '115200';
            }
            mavPortOpening();
        });
    } else {
    }
};

var aggr_content = {};

function send_aggr_to_Mobius(topic, content_each, gap) {
    if (aggr_content.hasOwnProperty(topic)) {
        var timestamp = moment().format('YYYY-MM-DDTHH:mm:ssSSS');
        aggr_content[topic][timestamp] = content_each;
    } else {
        aggr_content[topic] = {};
        timestamp = moment().format('YYYY-MM-DDTHH:mm:ssSSS');
        aggr_content[topic][timestamp] = content_each;

        setTimeout(function () {
            sh_adn.crtci(topic + '?rcn=0', 0, aggr_content[topic], null, function () {
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

        var targetCompId = (params.targetCompId == undefined) ?
            0 :
            params.targetCompId;

        switch (type) {
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
            case mavlink.MAVLINK_MSG_ID_PARAM_REQUEST_READ:
                mavMsg = new mavlink.messages.param_request_read(params.target_system,
                    params.target_component,
                    params.param_id,
                    params.param_index);
                break;
        }
    } catch (e) {
        console.log('MAVLINK EX:' + e);
    }

    if (mavMsg) {
        genMsg = Buffer.from(mavMsg.pack(mavlinkParser));
    }

    return genMsg;
}

function sendDroneMessage(type, params) {
    try {
        var msg = mavlinkGenerateMessage(my_system_id, type, params);
        if (msg == null) {
            console.log("mavlink message is null");
        } else {
            mavPortData(msg);
        }
    } catch (ex) {
        console.log('[ERROR] ' + ex);
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

    if (dji.flightstatus == '0') {
        params.base_mode = 81;
    } else {
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
    params.battery_remaining = dji.bat_percentage;
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
    } else {
        socket.write(JSON.stringify(cin));
    }
};

exports.gcs_noti_handler = function (message) {
    // console.log(message.toString('hex'));
    sh_adn.crtci(my_command_name + '?rcn=0', 0, message.toString('hex'), null, function () {
    });
    if (my_drone_type === 'dji') {
        var com_msg = message.toString();
        var com_message = com_msg.split(":");
        var msg_command = com_message[0];

        if (msg_command == 't' || msg_command == 'h' || msg_command == 'l') {
            socket_mav.write(message);
        } else if (msg_command == 'g') {
            if (com_message.length < 5) {
                for (var i = 0; i < (5 - com_message.length); i++) {
                    com_msg += ':0';
                }
                message = Buffer.from(com_msg);
            }
            socket_mav.write(message);

            var msg_lat = com_message[1].substring(0, 7);
            var msg_lon = com_message[2].substring(0, 7);
            var msg_alt = com_message[3].substring(0, 3);
        } else if (msg_command == 'm' || msg_command == 'a') {
            socket_mav.write(message);
        }
    } else if ((my_drone_type === 'pixhawk') || (my_drone_type === 'ardupilot') || (my_drone_type === 'px4')) {
        if (mavPort != null) {
            if (mavPort.isOpen) {
                mavPort.write(message);
            }
        }
    } else {

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
    } else {
        if (mavPort.isOpen) {

        } else {
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

    } else {
        console.log('mavPort error : ' + error);
    }

    setTimeout(mavPortOpening, 2000);
}

var mavStrFromDrone = '';
var mavStrFromDroneLength = 0;
var mavVersion = 'unknown';
var mavVersionCheckFlag = false;

function mavPortData(data) {
    mavStrFromDrone += data.toString('hex').toLowerCase();
    // console.log(mavStrFromDrone)

    while (mavStrFromDrone.length > 20) {
        if (!mavVersionCheckFlag) {
            var stx = mavStrFromDrone.substr(0, 2);
            if (stx === 'fe') {
                var len = parseInt(mavStrFromDrone.substr(2, 2), 16);
                var mavLength = (6 * 2) + (len * 2) + (2 * 2);
                var sysid = parseInt(mavStrFromDrone.substr(6, 2), 16);
                var msgid = parseInt(mavStrFromDrone.substr(10, 2), 16);

                if (msgid === 0 && len === 9) { // HEARTBEAT
                    mavVersionCheckFlag = true;
                    mavVersion = 'v1';
                }

                if ((mavStrFromDrone.length) >= mavLength) {
                    var mavPacket = mavStrFromDrone.substr(0, mavLength);

                    mavStrFromDrone = mavStrFromDrone.substr(mavLength);
                    mavStrFromDroneLength = 0;
                } else {
                    break;
                }
            } else if (stx === 'fd') {
                len = parseInt(mavStrFromDrone.substr(2, 2), 16);
                mavLength = (10 * 2) + (len * 2) + (2 * 2);

                sysid = parseInt(mavStrFromDrone.substr(10, 2), 16);
                msgid = parseInt(mavStrFromDrone.substr(18, 2) + mavStrFromDrone.substr(16, 2) + mavStrFromDrone.substr(14, 2), 16);

                if (msgid === 0 && len === 9) { // HEARTBEAT
                    mavVersionCheckFlag = true;
                    mavVersion = 'v2';
                }
                if (mavStrFromDrone.length >= mavLength) {
                    mavPacket = mavStrFromDrone.substr(0, mavLength);

                    mavStrFromDrone = mavStrFromDrone.substr(mavLength);
                    mavStrFromDroneLength = 0;
                } else {
                    break;
                }
            } else {
                mavStrFromDrone = mavStrFromDrone.substr(2);
            }
        } else {
            stx = mavStrFromDrone.substr(0, 2);
            if (mavVersion === 'v1' && stx === 'fe') {
                len = parseInt(mavStrFromDrone.substr(2, 2), 16);
                mavLength = (6 * 2) + (len * 2) + (2 * 2);

                if ((mavStrFromDrone.length) >= mavLength) {
                    mavPacket = mavStrFromDrone.substr(0, mavLength);

                    mqtt_client.publish(my_cnt_name, Buffer.from(mavPacket, 'hex'));
                    send_aggr_to_Mobius(my_cnt_name, mavPacket, 2000);
                    setTimeout(parseMavFromDrone, 0, mavPacket);

                    mavStrFromDrone = mavStrFromDrone.substr(mavLength);
                    mavStrFromDroneLength = 0;
                } else {
                    break;
                }
            } else if (mavVersion === 'v2' && stx === 'fd') {
                len = parseInt(mavStrFromDrone.substr(2, 2), 16);
                mavLength = (10 * 2) + (len * 2) + (2 * 2);

                if (mavStrFromDrone.length >= mavLength) {
                    mavPacket = mavStrFromDrone.substr(0, mavLength);

                    mqtt_client.publish(my_cnt_name, Buffer.from(mavPacket, 'hex'));
                    send_aggr_to_Mobius(my_cnt_name, mavPacket, 2000);
                    setTimeout(parseMavFromDrone, 0, mavPacket);

                    mavStrFromDrone = mavStrFromDrone.substr(mavLength);
                    mavStrFromDroneLength = 0;
                } else {
                    break;
                }
            } else {
                mavStrFromDrone = mavStrFromDrone.substr(2);
            }
        }
    }
}

var fc = {};
try {
    fc = JSON.parse(fs.readFileSync('fc_data_model.json', 'utf8'));
} catch (e) {
    fc.heartbeat = {};
    fc.heartbeat.type = 2;
    fc.heartbeat.autopilot = 3;
    fc.heartbeat.base_mode = 0;
    fc.heartbeat.custom_mode = 0;
    fc.heartbeat.system_status = 0;
    fc.heartbeat.mavlink_version = 1;

    fc.global_position_int = {};
    fc.global_position_int.time_boot_ms = 123456789;
    fc.global_position_int.lat = 0;
    fc.global_position_int.lon = 0;
    fc.global_position_int.alt = 0;
    fc.global_position_int.vx = 0;
    fc.global_position_int.vy = 0;
    fc.global_position_int.vz = 0;
    fc.global_position_int.hdg = 65535;

    fc.wp_yaw_behavior = {};
    fc.wp_yaw_behavior.value = 0;
    fc.wp_yaw_behavior.count = 0;
    fc.wp_yaw_behavior.index = 0;
    fc.wp_yaw_behavior.id = 0;
    fc.wp_yaw_behavior.type = 0;

    fs.writeFileSync('fc_data_model.json', JSON.stringify(fc, null, 4), 'utf8');
}

var flag_base_mode = 0;

function parseMavFromDrone(mavPacket) {
    try {
        var ver = mavPacket.substr(0, 2);
        if (ver == 'fd') {
            var sysid = mavPacket.substr(10, 2).toLowerCase();
            var msgid = mavPacket.substr(18, 2) + mavPacket.substr(16, 2) + mavPacket.substr(14, 2);
            var base_offset = 20;
        } else {
            sysid = mavPacket.substr(6, 2).toLowerCase();
            msgid = mavPacket.substr(10, 2).toLowerCase();
            base_offset = 12;
        }

        var sys_id = parseInt(sysid, 16);
        var msg_id = parseInt(msgid, 16);

        var cur_seq = parseInt(mavPacket.substr(4, 2), 16);

        if (msg_id == mavlink.MAVLINK_MSG_ID_GLOBAL_POSITION_INT) { // #33
            var time_boot_ms = mavPacket.substr(base_offset, 8).toLowerCase();
            base_offset += 8;
            var lat = mavPacket.substr(base_offset, 8).toLowerCase();
            base_offset += 8;
            var lon = mavPacket.substr(base_offset, 8).toLowerCase();
            base_offset += 8;
            var alt = mavPacket.substr(base_offset, 8).toLowerCase();
            base_offset += 8;
            var relative_alt = mavPacket.substr(base_offset, 8).toLowerCase();

            fc.global_position_int.time_boot_ms = Buffer.from(time_boot_ms, 'hex').readUInt32LE(0);
            fc.global_position_int.lat = Buffer.from(lat, 'hex').readInt32LE(0);
            fc.global_position_int.lon = Buffer.from(lon, 'hex').readInt32LE(0);
            fc.global_position_int.alt = Buffer.from(alt, 'hex').readInt32LE(0);
            fc.global_position_int.relative_alt = Buffer.from(relative_alt, 'hex').readInt32LE(0);

            muv_mqtt_client.publish(muv_pub_fc_gpi_topic, JSON.stringify(fc.global_position_int));
        } else if (msg_id == mavlink.MAVLINK_MSG_ID_HEARTBEAT) { // #00 : HEARTBEAT
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

            fc.heartbeat.type = Buffer.from(type, 'hex').readUInt8(0);
            fc.heartbeat.autopilot = Buffer.from(autopilot, 'hex').readUInt8(0);
            fc.heartbeat.base_mode = Buffer.from(base_mode, 'hex').readUInt8(0);
            fc.heartbeat.custom_mode = Buffer.from(custom_mode, 'hex').readUInt32LE(0);
            fc.heartbeat.system_status = Buffer.from(system_status, 'hex').readUInt8(0);
            fc.heartbeat.mavlink_version = Buffer.from(mavlink_version, 'hex').readUInt8(0);

            muv_mqtt_client.publish(muv_pub_fc_hb_topic, JSON.stringify(fc.heartbeat));

            // TODO: disarmed에도 sortie 생성하는 문제 수정
            // if ((fc.heartbeat.base_mode & 0x80) === 0x80) {
            //         start_arm_time = moment();
            //         my_sortie_name = moment().format('YYYY_MM_DD_T_HH_mm');
            //         my_cnt_name = my_parent_cnt_name + '/' + my_sortie_name;
            //         sh_adn.crtct(my_parent_cnt_name + '?rcn=0', my_sortie_name, 0, function (rsc, res_body, count) {
            //         });
            //         cal_flag = 1;
            //         cal_sortiename = my_sortie_name;
            // } else {
            //     if (cal_flag == 1) {
            //         cal_flag = 0;
            //         calculateFlightTime(cal_sortiename);
            //     }
            //     my_sortie_name = 'disarm';
            //     my_cnt_name = my_parent_cnt_name + '/' + my_sortie_name;
            //     my_gimbal_name = my_gimbal_parent + '/' + my_sortie_name;
            // }
            if (fc.heartbeat.base_mode & 0x80) {
                if (flag_base_mode == 3) {
                    start_arm_time = moment();
                    flag_base_mode++;
                    my_sortie_name = moment().format('YYYY_MM_DD_T_HH_mm');
                    my_cnt_name = my_parent_cnt_name + '/' + my_sortie_name;
                    sh_adn.crtct(my_parent_cnt_name + '?rcn=0', my_sortie_name, 0, function (rsc, res_body, count) {
                    });

                    // for (var idx in mission_parent) {
                    //     if (mission_parent.hasOwnProperty(idx)) {
                    //         setTimeout(createMissionContainer, 10, idx);
                    //     }
                    // }
                } else {
                    flag_base_mode++;
                    if (flag_base_mode > 16) {
                        flag_base_mode = 16;
                    }
                }
            } else {
                flag_base_mode = 0;

                my_sortie_name = 'disarm';
                my_cnt_name = my_parent_cnt_name + '/' + my_sortie_name;
                my_gimbal_name = my_gimbal_parent + '/' + my_sortie_name;
            }
        } else if (msg_id == mavlink.MAVLINK_MSG_ID_SYSTEM_TIME) { // #02 : SYSTEM_TIME
            muv_mqtt_client.publish(muv_pub_fc_system_time_topic, mavPacket);
        } else if (msg_id == mavlink.MAVLINK_MSG_ID_TIMESYNC) { // #111 : TIMESYNC
            muv_mqtt_client.publish(muv_pub_fc_timesync_topic, mavPacket);
        } else if (msg_id == mavlink.MAVLINK_MSG_ID_PARAM_VALUE) {
            let param_value = mavPacket.substr(base_offset, 8).toLowerCase();
            base_offset += 8;
            let param_count = mavPacket.substr(base_offset, 4).toLowerCase();
            base_offset += 4;
            let param_index = mavPacket.substr(base_offset, 4).toLowerCase();
            base_offset += 4;
            let param_id = mavPacket.substr(base_offset, 32).toLowerCase();
            base_offset += 32;
            let param_type = mavPacket.substr(base_offset, 2).toLowerCase();

            fc.wp_yaw_behavior.id = Buffer.from(param_id, "hex").toString('ASCII').toLowerCase();
            fc.wp_yaw_behavior.id = fc.wp_yaw_behavior.id.replace(/\0/g, '');

            if (fc.wp_yaw_behavior.id === 'wp_yaw_behavior') {
                fc.wp_yaw_behavior.value = Buffer.from(param_value, 'hex').readFloatLE(0);
                fc.wp_yaw_behavior.type = Buffer.from(param_type, 'hex').readInt8(0);
                fc.wp_yaw_behavior.count = Buffer.from(param_count, 'hex').readInt16LE(0);
                fc.wp_yaw_behavior.index = Buffer.from(param_index, 'hex').readUInt16LE(0);

                muv_mqtt_client.publish(muv_pub_fc_wp_yaw_behavior_topic, JSON.stringify(fc.wp_yaw_behavior));
            }
        }
    } catch (e) {
        console.log('[parseMavFromDrone Error]', e);
    }
}

// function createMissionContainer(idx) {
//     var mission_parent_path = mission_parent[idx];
//     sh_adn.crtct(mission_parent_path + '?rcn=0', my_sortie_name, 0, function (rsc, res_body, count) {
//     });
// }

