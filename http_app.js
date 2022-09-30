/**
 * Copyright (c) 2018, OCEAN
 * All rights reserved.
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * 1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * 3. The name of the author may not be used to endorse or promote products derived from this software without specific prior written permission.
 * THIS SOFTWARE IS PROVIDED BY THE AUTHOR ``AS IS'' AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

/**
 * Created by ryeubi on 2015-08-31.
 */

var http = require('http');
var express = require('express');
var fs = require('fs');
var mqtt = require('mqtt');
var util = require('util');
var url = require('url');
var ip = require('ip');
var shortid = require('shortid');
var moment = require('moment');
var {spawn, exec} = require('child_process');
const os = require("os");
const dgram = require("dgram");
var {nanoid} = require('nanoid');

global.sh_adn = require('./http_adn');
var noti = require('./noti');
var tas_mav = require('./thyme_tas_mav');
//var tas_sec = require('./thyme_tas_sec');
//var tas_mission = require('./thyme_tas_mission');

var HTTP_SUBSCRIPTION_ENABLE = 0;
var MQTT_SUBSCRIPTION_ENABLE = 0;

global.my_control_type = '';
global.my_gcs_name = '';
global.my_parent_cnt_name = '';
global.my_cnt_name = '';
global.pre_my_cnt_name = '';
global.my_mission_parent = '';
global.my_mission_name = '';
global.my_sortie_name = 'disarm';
global.my_gimbal_parent = '';
global.my_gimbal_name = '';
global.my_command_parent_name = '';
global.my_command_name = '';

global.my_drone_type = 'pixhawk';
global.my_secure = 'off';
global.my_system_id = 8;

global.gimbal = {};

global.my_rf_host = '';
global.my_rf_address = '';

global.Req_auth = '';
global.Res_auth = '';
global.Result_auth = '';
global.Certification = '';

const retry_interval = 2500;
const normal_interval = 100;

global.authResult = 'yet';

var app = express();

var server = null;
var noti_topic = '';
var muv_sub_gcs_topic = '';

var muv_sub_msw_topic = [];

global.muv_pub_fc_gpi_topic = '';
global.muv_pub_fc_hb_topic = '';
global.muv_pub_fc_attitude_topic = '';
global.muv_pub_fc_bat_state_topic = '';
global.muv_pub_fc_system_time_topic = '';
global.muv_pub_fc_timesync_topic = '';
global.muv_pub_fc_wp_yaw_behavior_topic = '';

global.getType = function (p) {
    var type = 'string';
    if (Array.isArray(p)) {
        type = 'array';
    } else if (typeof p === 'string') {
        try {
            var _p = JSON.parse(p);
            if (typeof _p === 'object') {
                type = 'string_object';
            } else {
                type = 'string';
            }
        } catch (e) {
            type = 'string';
            return type;
        }
    } else if (p != null && typeof p === 'object') {
        type = 'object';
    } else {
        type = 'other';
    }

    return type;
};

// ready for mqtt
for (var i = 0; i < conf.sub.length; i++) {
    if (conf.sub[i].name != null) {
        if (url.parse(conf.sub[i].nu).protocol === 'http:') {
            HTTP_SUBSCRIPTION_ENABLE = 1;
            if (url.parse(conf.sub[i]['nu']).hostname === 'autoset') {
                conf.sub[i]['nu'] = 'http://' + ip.address() + ':' + conf.ae.port + url.parse(conf.sub[i]['nu']).pathname;
            }
        } else if (url.parse(conf.sub[i].nu).protocol === 'mqtt:') {
            MQTT_SUBSCRIPTION_ENABLE = 1;
        } else {
            // console.log('notification uri of subscription is not supported');
            // process.exit();
        }
    }
}

var return_count = 0;
var request_count = 0;

function ready_for_notification() {
    if (HTTP_SUBSCRIPTION_ENABLE == 1) {
        server = http.createServer(app);
        server.listen(conf.ae.port, function () {
            console.log('http_server running at ' + conf.ae.port + ' port');
        });
    }

    if (MQTT_SUBSCRIPTION_ENABLE == 1) {
        for (var i = 0; i < conf.sub.length; i++) {
            if (conf.sub[i].name != null) {
                if (url.parse(conf.sub[i].nu).protocol === 'mqtt:') {
                    if (url.parse(conf.sub[i]['nu']).hostname === 'autoset') {
                        conf.sub[i]['nu'] = 'mqtt://' + conf.cse.host + '/' + conf.ae.id;
                        noti_topic = util.format('/oneM2M/req/+/%s/#', conf.ae.id);
                    } else if (url.parse(conf.sub[i]['nu']).hostname === conf.cse.host) {
                        noti_topic = util.format('/oneM2M/req/+/%s/#', conf.ae.id);
                    } else {
                        noti_topic = util.format('%s', url.parse(conf.sub[i].nu).pathname);
                    }
                }
            }
        }
        mqtt_connect(conf.cse.host, muv_sub_gcs_topic, noti_topic);

       

        muv_mqtt_connect('localhost', 1883, muv_sub_msw_topic, muv_sub_gcs_topic);
    }
}

function git_clone(mission_name, directory_name, repository_url) {
    try {
        require('fs-extra').removeSync('./' + directory_name);
    } catch (e) {
        console.log(e.message);
    }

    var gitClone = spawn('git', ['clone', repository_url, directory_name]);

    gitClone.stdout.on('data', function (data) {
        console.log('stdout: ' + data);
    });

    gitClone.stderr.on('data', function (data) {
        console.log('stderr: ' + data);
    });

    gitClone.on('exit', function (code) {
        console.log('exit: ' + code);

        setTimeout(npm_install, 5000, mission_name, directory_name);
    });

    gitClone.on('error', function (code) {
        console.log('error: ' + code);
    });
}

function git_pull(mission_name, directory_name) {
    try {
        if (process.platform === 'win32') {
            var cmd = 'git'
        } else {
            cmd = 'git'
        }

        var gitPull = spawn(cmd, ['pull'], {cwd: process.cwd() + '/' + directory_name});

        gitPull.stdout.on('data', function (data) {
            console.log('stdout: ' + data);
        });

        gitPull.stderr.on('data', function (data) {
            console.log('stderr: ' + data);
        });

        gitPull.on('exit', function (code) {
            console.log('exit: ' + code);

            setTimeout(npm_install, 1000, mission_name, directory_name);
        });

        gitPull.on('error', function (code) {
            console.log('error: ' + code);

            //setTimeout(npm_install, 10, msw_name, directory_name);
        });
    } catch (e) {
        console.log(e.message);
    }
}

function npm_install(mission_name, directory_name) {
    try {
        if (process.platform === 'win32') {
            var cmd = 'npm.cmd'
        } else {
            cmd = 'npm'
        }

        var npmInstall = spawn(cmd, ['install'], {cwd: process.cwd() + '/' + directory_name});

        npmInstall.stdout.on('data', function (data) {
            console.log('stdout: ' + data);
        });

        npmInstall.stderr.on('data', function (data) {
            console.log('stderr: ' + data);
        });

        npmInstall.on('exit', function (code) {
            console.log('exit: ' + code);

            setTimeout(fork_msw, 10, mission_name, directory_name);
        });

        npmInstall.on('error', function (code) {
            console.log('error: ' + code);

            setTimeout(npm_install, 10, mission_name, directory_name);
        });
    } catch (e) {
        console.log(e.message);
    }
}

// function fork_msw(mission_name, directory_name) {
//     var executable_name = directory_name.replace(mission_name + '_', '');
//
//     var nodeMsw = spawn('node', [executable_name], {cwd: process.cwd() + '/' + directory_name});
//
//     nodeMsw.stdout.on('data', function (data) {
//         console.log('stdout: ' + data);
//     });
//
//     nodeMsw.stderr.on('data', function (data) {
//         console.log('stderr: ' + data);
//     });
//
//     nodeMsw.on('exit', function (code) {
//         console.log('exit: ' + code);
//     });
//
//     nodeMsw.on('error', function (code) {
//         console.log('error: ' + code);
//
//         setTimeout(npm_install, 10, directory_name);
//     });
// }

function fork_msw(mission_name, directory_name) {
    var executable_name = directory_name.replace(mission_name + '_', '');

    var nodeMsw = exec('sh ' + executable_name + '.sh', {cwd: process.cwd() + '/' + directory_name});

    nodeMsw.stdout.on('data', function (data) {
        console.log('stdout: ' + data);
    });

    nodeMsw.stderr.on('data', function (data) {
        console.log('stderr: ' + data);
    });

    nodeMsw.on('exit', function (code) {
        console.log('exit: ' + code);
    });

    nodeMsw.on('error', function (code) {
        console.log('error: ' + code);

        setTimeout(npm_install, 10, directory_name);
    });
}

// global.msw_directory = {};
//
// function requireMsw(mission_name, directory_name) {
//     var require_msw_name = directory_name.replace(mission_name + '_', '');
//
//     msw_directory[mission_name] = directory_name;
//
//     setTimeout(run_webrtc, 10, mission_name, directory_name);
// }

function ae_response_action(status, res_body, callback) {
    var aeid = res_body['m2m:ae']['aei'];
    conf.ae.id = aeid;
    callback(status, aeid);
}

function create_cnt_all(count, callback) {
    if (conf.cnt.length == 0) {
        callback(2001, count);
    } else {
        if (conf.cnt.hasOwnProperty(count)) {
            var parent = conf.cnt[count].parent;
            var rn = conf.cnt[count].name;
            sh_adn.crtct(parent, rn, count, function (rsc, res_body, count) {
                if (rsc == 5106 || rsc == 2001 || rsc == 4105) {
                    create_cnt_all(++count, function (status, count) {
                        callback(status, count);
                    });
                } else {
                    callback(9999, count);
                }
            });
        } else {
            callback(2001, count);
        }
    }
}

function delete_sub_all(count, callback) {
    if (conf.sub.length == 0) {
        callback(2001, count);
    } else {
        if (conf.sub.hasOwnProperty(count)) {
            var target = conf.sub[count].parent + '/' + conf.sub[count].name;
            sh_adn.delsub(target, count, function (rsc, res_body, count) {
                if (rsc == 5106 || rsc == 2002 || rsc == 2000 || rsc == 4105 || rsc == 4004) {
                    delete_sub_all(++count, function (status, count) {
                        callback(status, count);
                    });
                } else {
                    callback(9999, count);
                }
            });
        } else {
            callback(2001, count);
        }
    }
}

function create_sub_all(count, callback) {
    if (conf.sub.length == 0) {
        callback(2001, count);
    } else {
        if (conf.sub.hasOwnProperty(count)) {
            var parent = conf.sub[count].parent;
            var rn = conf.sub[count].name;
            var nu = conf.sub[count].nu;
            sh_adn.crtsub(parent, rn, nu, count, function (rsc, res_body, count) {
                if (rsc == 5106 || rsc == 2001 || rsc == 4105) {
                    create_sub_all(++count, function (status, count) {
                        callback(status, count);
                    });
                } else {
                    callback('9999', count);
                }
            });
        } else {
            callback(2001, count);
        }
    }
}

global.drone_info = {};
global.mission_parent = [];

function retrieve_my_cnt_name(callback) {
    sh_adn.rtvct('/Mobius/' + conf.ae.approval_gcs + '/approval/' + conf.ae.name + '/la', 0, function (rsc, res_body, count) {
        if (rsc == 2000) {
            drone_info = res_body[Object.keys(res_body)[0]].con;
            //console.log(drone_info);

            if (drone_info.hasOwnProperty('update')) {
                if (drone_info.update === 'enable' || drone_info.update === 'nCube') {
                    const shell = require('shelljs')

                    if (shell.exec('git reset --hard HEAD && git pull').code !== 0) {
                        shell.echo('Error: command failed')
                        shell.exit(1)
                    } else {
                        console.log('Finish update !');
                        drone_info.update = 'disable';
                        sh_adn.crtci('/Mobius/' + conf.ae.approval_gcs + '/approval/' + conf.ae.name, 0, JSON.stringify(drone_info), null, function (){
                            if (drone_info.update === 'disable'){
                                shell.exec('pm2 restart MUV')
                            }
                        });
                    }
                }
            }

            conf.sub = [];
            conf.cnt = [];
            conf.fc = [];

            if (drone_info.hasOwnProperty('gcs')) {
                my_gcs_name = drone_info.gcs;
            } else {
                my_gcs_name = 'KETI_MUV';
            }

            if (drone_info.hasOwnProperty('host')) {
                conf.cse.host = drone_info.host;
            } else {
            }

            console.log("gcs host is " + conf.cse.host);

            var info = {};
            info.parent = '/Mobius/' + drone_info.gcs;
            info.name = 'Drone_Data';
            conf.cnt.push(JSON.parse(JSON.stringify(info)));

            info = {};
            info.parent = '/Mobius/' + drone_info.gcs + '/Drone_Data';
            info.name = drone_info.drone;
            conf.cnt.push(JSON.parse(JSON.stringify(info)));

            info.parent = '/Mobius/' + drone_info.gcs + '/Drone_Data/' + drone_info.drone;
            info.name = my_sortie_name;
            conf.cnt.push(JSON.parse(JSON.stringify(info)));

            my_parent_cnt_name = info.parent;
            my_cnt_name = my_parent_cnt_name + '/' + info.name;

            // set container for mission
            info = {};
            info.parent = '/Mobius/' + drone_info.gcs;
            info.name = 'Mission_Data';
            conf.cnt.push(JSON.parse(JSON.stringify(info)));

            info = {};
            info.parent = '/Mobius/' + drone_info.gcs + '/Mission_Data';
            info.name = drone_info.drone;
            conf.cnt.push(JSON.parse(JSON.stringify(info)));

            if (drone_info.hasOwnProperty('mission')) {
                for (var mission_name in drone_info.mission) {
                    if (drone_info.mission.hasOwnProperty(mission_name)) {
                        info = {};
                        info.parent = '/Mobius/' + drone_info.gcs + '/Mission_Data/' + drone_info.drone;
                        info.name = mission_name;
                        conf.cnt.push(JSON.parse(JSON.stringify(info)));

                        var chk_cnt = 'container';
                        if (drone_info.mission[mission_name].hasOwnProperty(chk_cnt)) {
                            for (var idx in drone_info.mission[mission_name][chk_cnt]) {
                                if (drone_info.mission[mission_name][chk_cnt].hasOwnProperty(idx)) {
                                    var container_name = drone_info.mission[mission_name][chk_cnt][idx].split(':')[0];
                                    info = {};
                                    info.parent = '/Mobius/' + drone_info.gcs + '/Mission_Data/' + drone_info.drone + '/' + mission_name;
                                    info.name = container_name;
                                    conf.cnt.push(JSON.parse(JSON.stringify(info)));

                                    // muv_sub_msw_topic.push(info.parent + '/' + info.name);

                                    info = {};
                                    info.parent = '/Mobius/' + drone_info.gcs + '/Mission_Data/' + drone_info.drone + '/' + mission_name + '/' + container_name;
                                    info.name = my_sortie_name;
                                    conf.cnt.push(JSON.parse(JSON.stringify(info)));
                                    mission_parent.push(info.parent);

                                    muv_sub_msw_topic.push(info.parent + '/#');

                                    if (drone_info.mission[mission_name][chk_cnt][idx].split(':').length > 1) {
                                        info = {};
                                        info.parent = '/Mobius/' + drone_info.gcs + '/Mission_Data/' + drone_info.drone + '/' + mission_name + '/' + container_name;
                                        info.name = 'sub_msw';
                                        info.nu = 'mqtt://' + conf.cse.host + '/' + drone_info.mission[mission_name][chk_cnt][idx].split(':')[1] + '?ct=json';
                                        conf.sub.push(JSON.parse(JSON.stringify(info)));
                                    }
                                }
                            }
                        }

                        chk_cnt = 'sub_container';
                        if (drone_info.mission[mission_name].hasOwnProperty(chk_cnt)) {
                            for (idx in drone_info.mission[mission_name][chk_cnt]) {
                                if (drone_info.mission[mission_name][chk_cnt].hasOwnProperty(idx)) {
                                    container_name = drone_info.mission[mission_name][chk_cnt][idx];
                                    info = {};
                                    info.parent = '/Mobius/' + drone_info.gcs + '/Mission_Data/' + drone_info.drone + '/' + mission_name;
                                    info.name = container_name;
                                    conf.cnt.push(JSON.parse(JSON.stringify(info)));

                                    info = {};
                                    info.parent = '/Mobius/' + drone_info.gcs + '/Mission_Data/' + drone_info.drone + '/' + mission_name + '/' + container_name;
                                    info.name = 'sub_msw';
                                    info.nu = 'mqtt://' + conf.cse.host + '/' + conf.ae.id + '?ct=json';
                                    conf.sub.push(JSON.parse(JSON.stringify(info)));
                                }
                            }
                        }

                        chk_cnt = 'fc_container';
                        if (drone_info.mission[mission_name].hasOwnProperty(chk_cnt)) {
                            for (idx in drone_info.mission[mission_name][chk_cnt]) {
                                if (drone_info.mission[mission_name][chk_cnt].hasOwnProperty(idx)) {
                                    container_name = drone_info.mission[mission_name][chk_cnt][idx];
                                    info = {};
                                    info.parent = '/Mobius/' + drone_info.gcs + '/Mission_Data/' + drone_info.drone + '/' + mission_name;
                                    info.name = container_name;
                                    conf.fc.push(JSON.parse(JSON.stringify(info)));
                                }
                            }
                        }

                        chk_cnt = 'git';
                        if (drone_info.mission[mission_name].hasOwnProperty(chk_cnt)) {
                            var repo_arr = drone_info.mission[mission_name][chk_cnt].split('/');
                            var directory_name = mission_name + '_' + repo_arr[repo_arr.length - 1].replace('.git', '');
                            try {
                                if (fs.existsSync('./' + directory_name)) {
                                    setTimeout(git_pull, 10, mission_name, directory_name);
                                } else {
                                    setTimeout(git_clone, 10, mission_name, directory_name, drone_info.mission[mission_name][chk_cnt]);
                                }
                            } catch (e) {
                                console.log(e.message);
                            }
                        }
                    }
                }
            }

            if (drone_info.hasOwnProperty('mav_ver')) {
                mav_ver = drone_info.mav_ver;
            } else {
                mav_ver = 'v1';
            }

            if (drone_info.hasOwnProperty('type')) {
                my_drone_type = drone_info.type;
            } else {
                my_drone_type = 'pixhawk';
            }

            var drone_type = {};
            drone_type.type = my_drone_type;
            fs.writeFileSync('drone_type.json', JSON.stringify(drone_type, null, 4), 'utf8');

            if (drone_info.hasOwnProperty('secure')) {
                my_secure = drone_info.secure;
            } else {
                my_secure = 'off';
            }

            if (drone_info.hasOwnProperty('system_id')) {
                my_system_id = drone_info.system_id;
            } else {
                my_system_id = 8;
            }

            if (drone_info.hasOwnProperty('gimbal')) {
                gimbal.type = drone_info.gimbal.type;
                gimbal.portnum = drone_info.gimbal.portnum;
                gimbal.baudrate = drone_info.gimbal.baudrate;
            }

            // set container for gimbal
            var info = {};
            info.parent = '/Mobius/' + drone_info.gcs;
            info.name = 'Gimbal_Data';
            conf.cnt.push(JSON.parse(JSON.stringify(info)));

            info = {};
            info.parent = '/Mobius/' + drone_info.gcs + '/Gimbal_Data';
            info.name = drone_info.drone;
            conf.cnt.push(JSON.parse(JSON.stringify(info)));

            info.parent = '/Mobius/' + drone_info.gcs + '/Gimbal_Data/' + drone_info.drone;
            info.name = my_sortie_name;
            conf.cnt.push(JSON.parse(JSON.stringify(info)));

            my_gimbal_parent = info.parent;
            my_gimbal_name = my_gimbal_parent + '/' + info.name;

            // muv_pub_fc_gpi_topic = '/Mobius/' + drone_info.gcs + '/Drone_Data/' + drone_info.drone + '/global_position_int';
            // muv_pub_fc_hb_topic = '/Mobius/' + drone_info.gcs + '/Drone_Data/' + drone_info.drone + '/heartbeat';
            // muv_pub_fc_system_time_topic = '/Mobius/' + drone_info.gcs + '/Drone_Data/' + drone_info.drone + '/system_time';
            // muv_pub_fc_timesync_topic = '/Mobius/' + drone_info.gcs + '/Drone_Data/' + drone_info.drone + '/timesync';
            // muv_pub_fc_attitude_topic = '/Mobius/' + drone_info.gcs + '/Drone_Data/' + drone_info.drone + '/attitude';
            // muv_pub_fc_bat_state_topic = '/Mobius/' + drone_info.gcs + '/Drone_Data/' + drone_info.drone + '/battery_status';
            // muv_pub_fc_wp_yaw_behavior_topic = '/Mobius/' + drone_info.gcs + '/Drone_Data/' + drone_info.drone + '/wp_yaw_behavior';
            muv_pub_fc_gpi_topic = '/TELE/drone/gpi'
            muv_pub_fc_hb_topic = '/TELE/drone/hb'
            muv_pub_fc_wp_yaw_behavior_topic = '/TELE/drone/wp_yaw_behavior'
            muv_pub_fc_distance_sensor_topic = '/TELE/drone/distance_sensor'
            muv_pub_fc_timesync_topic = '/TELE/drone/timesync'
            muv_pub_fc_system_time_topic = '/TELE/drone/system_time'
            muv_sub_gcs_topic = '/Mobius/' + my_gcs_name + '/GCS_Data/' + drone_info.drone;

            var info = {};
            info.parent = '/Mobius/' + drone_info.gcs;
            info.name = 'GCS_Data';
            conf.cnt.push(JSON.parse(JSON.stringify(info)));

            info = {};
            info.parent = '/Mobius/' + drone_info.gcs + '/GCS_Data';
            info.name = drone_info.drone;
            conf.cnt.push(JSON.parse(JSON.stringify(info)));

            my_command_parent_name = info.parent;
            my_command_name = my_command_parent_name + '/' + info.name;

            MQTT_SUBSCRIPTION_ENABLE = 1;
            sh_state = 'crtct';
            setTimeout(http_watchdog, normal_interval);

            drone_info.id = conf.ae.name;
            console.log(drone_info);
            fs.writeFileSync('drone_info.json', JSON.stringify(drone_info, null, 4), 'utf8');

            callback();
        } else {
            console.log('x-m2m-rsc : ' + rsc + ' <----' + res_body);
            setTimeout(http_watchdog, retry_interval);
            callback();
        }
    });
}

function http_watchdog() {
    if (sh_state === 'rtvct') {
        retrieve_my_cnt_name(function () {

        });
    } else if (sh_state === 'crtae') {
        console.log('[sh_state] : ' + sh_state);
        sh_adn.crtae(conf.ae.parent, conf.ae.name, conf.ae.appid, function (status, res_body) {
            console.log(res_body);
            if (status == 2001) {
                ae_response_action(status, res_body, function (status, aeid) {
                    console.log('x-m2m-rsc : ' + status + ' - ' + aeid + ' <----');
                    sh_state = 'rtvae';
                    request_count = 0;
                    return_count = 0;

                    setTimeout(http_watchdog, normal_interval);
                });
            } else if (status == 5106 || status == 4105) {
                console.log('x-m2m-rsc : ' + status + ' <----');
                sh_state = 'rtvae';

                setTimeout(http_watchdog, normal_interval);
            } else {
                console.log('x-m2m-rsc : ' + status + ' <----');
                setTimeout(http_watchdog, retry_interval);
            }
        });
    } else if (sh_state === 'rtvae') {
        if (conf.ae.id === 'S') {
            conf.ae.id = 'S' + shortid.generate();
        }

        console.log('[sh_state] : ' + sh_state);
        sh_adn.rtvae(conf.ae.parent + '/' + conf.ae.name, function (status, res_body) {
            if (status == 2000) {
                var aeid = res_body['m2m:ae']['aei'];
                console.log('x-m2m-rsc : ' + status + ' - ' + aeid + ' <----');

                if (conf.ae.id != aeid && conf.ae.id != ('/' + aeid)) {
                    console.log('AE-ID created is ' + aeid + ' not equal to device AE-ID is ' + conf.ae.id);
                } else {
                    sh_state = 'crtct';
                    request_count = 0;
                    return_count = 0;

                    setTimeout(http_watchdog, normal_interval);
                }
            } else {
                console.log('x-m2m-rsc : ' + status + ' <----');
                setTimeout(http_watchdog, retry_interval);
            }
        });
    } else if (sh_state === 'crtct') {
        console.log('[sh_state] : ' + sh_state);
        create_cnt_all(request_count, function (status, count) {
            if (status == 9999) {
                setTimeout(http_watchdog, retry_interval);
            } else {
                request_count = ++count;
                return_count = 0;
                if (conf.cnt.length <= count) {
                    sh_state = 'delsub';
                    request_count = 0;
                    return_count = 0;

                    setTimeout(http_watchdog, normal_interval);
                }
            }
        });
    } else if (sh_state === 'delsub') {
        console.log('[sh_state] : ' + sh_state);
        delete_sub_all(request_count, function (status, count) {
            if (status == 9999) {
                setTimeout(http_watchdog, retry_interval);
            } else {
                request_count = ++count;
                return_count = 0;
                if (conf.sub.length <= count) {
                    sh_state = 'crtsub';
                    request_count = 0;
                    return_count = 0;

                    setTimeout(http_watchdog, normal_interval);
                }
            }
        });
    } else if (sh_state === 'crtsub') {
        console.log('[sh_state] : ' + sh_state);
        create_sub_all(request_count, function (status, count) {
            if (status == 9999) {
                setTimeout(http_watchdog, retry_interval);
            } else {
                request_count = ++count;
                return_count = 0;
                if (conf.sub.length <= count) {
                    sh_state = 'crtci';

                    ready_for_notification();

                    tas_mav.ready();
                    // tas_sec.ready();
                    // tas_mission.ready();
                    if (gimbal.hasOwnProperty('type')) {
                        setTimeout(() => {
                            require('./thyme_tas_gimbal')
                        }, 500);
                    }

                    setTimeout(http_watchdog, normal_interval);
                }
            }
        });
    } else if (sh_state === 'crtci') {
        //setTimeout(check_rtv_cnt, 10000);
    }
}

setTimeout(http_watchdog, normal_interval);

// function check_rtv_cnt() {
//     sh_state = 'rtvct';
//     http_watchdog();
// }

function mqtt_connect(serverip, sub_gcs_topic, noti_topic) {
    if (mqtt_client == null) {
        if (conf.usesecure === 'disable') {
            var connectOptions = {
                host: serverip,
                port: conf.cse.mqttport,
                protocol: "mqtt",
                keepalive: 10,
                protocolId: "MQTT",
                protocolVersion: 4,
                clean: true,
                reconnectPeriod: 2000,
                connectTimeout: 2000,
                rejectUnauthorized: false
            };
        } else {
            connectOptions = {
                host: serverip,
                port: conf.cse.mqttport,
                protocol: "mqtts",
                keepalive: 10,
                protocolId: "MQTT",
                protocolVersion: 4,
                clean: true,
                reconnectPeriod: 2000,
                connectTimeout: 2000,
                key: fs.readFileSync("./server-key.pem"),
                cert: fs.readFileSync("./server-crt.pem"),
                rejectUnauthorized: false
            };
        }

        mqtt_client = mqtt.connect(connectOptions);

        mqtt_client.on('connect', function () {
            console.log('fc_mqtt is connected');

            if (sub_gcs_topic != '') {
                mqtt_client.subscribe(sub_gcs_topic, function () {
                    console.log('[mqtt_connect] sub_gcs_topic is subscribed: ' + sub_gcs_topic);
                });
            }

            if (noti_topic != '') {
                mqtt_client.subscribe(noti_topic, function () {
                    console.log('[mqtt_connect] noti_topic is subscribed:  ' + noti_topic);
                });
            }
        });

        mqtt_client.on('message', function (topic, message) {
            if (topic == sub_gcs_topic) {
                tas_mav.gcs_noti_handler(message);
            } else {
                // if (topic.includes('/oneM2M/req/')) {
                //     var jsonObj = JSON.parse(message.toString());
                //
                //     if (jsonObj['m2m:rqp'] == null) {
                //         jsonObj['m2m:rqp'] = jsonObj;
                //     }
                //
                //     noti.mqtt_noti_action(topic.split('/'), jsonObj);
                // } else {
                // }
            }
        });

        mqtt_client.on('error', function (err) {
            console.log('[mqtt_client error] ' + err.message);
        });
    }
}

function rf_mqtt_connect(serverip, sub_gcs_topic, noti_topic) {
    if (rf_mqtt_client == null) {
        if (conf.usesecure === 'disable') {
            var connectOptions = {
                host: serverip,
                port: conf.cse.mqttport,
                protocol: "mqtt",
                keepalive: 10,
                protocolId: "MQTT",
                protocolVersion: 4,
                clientId: 'MUV_' + nanoid(15),
                clean: true,
                reconnectPeriod: 2000,
                connectTimeout: 2000,
                rejectUnauthorized: false
            };
        } else {
            connectOptions = {
                host: serverip,
                port: conf.cse.mqttport,
                protocol: "mqtts",
                keepalive: 10,
                protocolId: "MQTT",
                protocolVersion: 4,
                clientId: 'MUV_' + nanoid(15),
                clean: true,
                reconnectPeriod: 2000,
                connectTimeout: 2000,
                key: fs.readFileSync("./server-key.pem"),
                cert: fs.readFileSync("./server-crt.pem"),
                rejectUnauthorized: false
            };
        }

        rf_mqtt_client = mqtt.connect(connectOptions);

        rf_mqtt_client.on('connect', function () {
            console.log('rf_mqtt is connected to ' + serverip);

            if (sub_gcs_topic != '') {
                rf_mqtt_client.subscribe(sub_gcs_topic, function () {
                    console.log('[rf_mqtt_connect] sub_gcs_topic is subscribed: ' + sub_gcs_topic);
                });
            }

            // if (noti_topic != '') {
            //     rf_mqtt_client.subscribe(noti_topic, function () {
            //         console.log('[rf_mqtt_connect] noti_topic is subscribed:  ' + noti_topic);
            //     });
            // }
        });

        rf_mqtt_client.on('message', function (topic, message) {
            if (topic == sub_gcs_topic) {
                console.log('[GCS]', topic, message.toString('hex'));
                tas_mav.gcs_noti_handler(message);
            } else {
                // if (topic.includes('/oneM2M/req/')) {
                //     var jsonObj = JSON.parse(message.toString());
                //
                //     if (jsonObj['m2m:rqp'] == null) {
                //         jsonObj['m2m:rqp'] = jsonObj;
                //     }
                //
                //     noti.mqtt_noti_action(topic.split('/'), jsonObj);
                // } else {
                // }
            }
        });

        rf_mqtt_client.on('error', function (err) {
            console.log('[rf_mqtt_client error] ' + err.message);
        });
    }
}

function muv_mqtt_connect(broker_ip, port, noti_topic, sub_gcs_topic) {
    if (muv_mqtt_client == null) {
        if (conf.usesecure === 'disable') {
            var connectOptions = {
                host: broker_ip,
                port: port,
                protocol: "mqtt",
                keepalive: 10,
                protocolId: "MQTT",
                protocolVersion: 4,
                clean: true,
                reconnectPeriod: 2000,
                connectTimeout: 2000,
                rejectUnauthorized: false
            };
        } else {
            connectOptions = {
                host: broker_ip,
                port: port,
                protocol: "mqtts",
                keepalive: 10,
                protocolId: "MQTT",
                protocolVersion: 4,
                clean: true,
                reconnectPeriod: 2000,
                connectTimeout: 2000,
                key: fs.readFileSync("./server-key.pem"),
                cert: fs.readFileSync("./server-crt.pem"),
                rejectUnauthorized: false
            };
        }

        muv_mqtt_client = mqtt.connect(connectOptions);

        muv_mqtt_client.on('connect', function () {
            console.log('muv_mqtt connected to ' + broker_ip);
            if (sub_gcs_topic != '') {
                muv_mqtt_client.subscribe(sub_gcs_topic, function () {
                    console.log('[muv_mqtt_connect] sub_gcs_topic is subscribed: ' + sub_gcs_topic);
                });
            }

            for (var idx in noti_topic) {
                if (noti_topic.hasOwnProperty(idx)) {
                    muv_mqtt_client.subscribe(noti_topic[idx]);
                    console.log('[muv_mqtt_connect] noti_topic[' + idx + ']: ' + noti_topic[idx]);
                }
            }
        });

        muv_mqtt_client.on('message', function (topic, message) {
            try {
                if (topic === sub_gcs_topic) {
                    tas_mav.gcs_noti_handler(message);
                } else {
                    var msg_obj = JSON.parse(message.toString());
                    send_to_Mobius((topic), msg_obj, parseInt(Math.random() * 10));
                    //console.log(topic + ' - ' + JSON.stringify(msg_obj));
                }
            } catch (e) {
                msg_obj = message.toString();
                send_to_Mobius((topic), msg_obj, parseInt(Math.random() * 10));
                //console.log(topic + ' - ' + msg_obj);
            }
        });

        muv_mqtt_client.on('error', function (err) {
            console.log('[muv_mqtt_client error] ' + err.message);
        });
    }
}

function send_to_Mobius(topic, content_each_obj, gap) {
    setTimeout(function (topic, content_each_obj) {
        sh_adn.crtci(topic + '/' + my_sortie_name + '?rcn=0', 0, content_each_obj, null, function () {

        });
    }, gap, topic, content_each_obj);
}

function setIPandRoute(host) {
    let host_arr = host.split('.');

    var networkInterfaces = os.networkInterfaces();
    if (networkInterfaces.hasOwnProperty('eth0')) {
        if (networkInterfaces['eth0'][0].family === 'IPv4') {
            if (networkInterfaces['eth0'][0].address !== my_rf_address) {
                // set static ip
                exec('sudo ifconfig eth0 ' + my_rf_address, (error, stdout, stderr) => {
                    if (error) {
                        console.error(`[error] in static ip setting : ${error}`);
                        return;
                    }
                    if (stdout) {
                        console.log(`stdout: ${stdout}`);
                    }
                    if (stderr) {
                        console.error(`stderr: ${stderr}`);
                    }
                    console.log(os.networkInterfaces());
                    // set route
                    exec('sudo route add -net ' + host_arr[0] + '.' + host_arr[1] + '.' + host_arr[2] + '.0 netmask 255.255.255.0 gw ' + my_rf_address, (error, stdout, stderr) => {
                        if (error) {
                            console.error(`[error] in routing table setting : ${error}`);
                            return;
                        }
                        if (stdout) {
                            console.log(`stdout: ${stdout}`);
                        }
                        if (stderr) {
                            console.error(`stderr: ${stderr}`);
                        }
                        exec('route', (error, stdout, stderr) => {
                            if (error) {
                                console.error(`[error] in routing table setting : ${error}`);
                                return;
                            }
                            if (stdout) {
                                console.log(`stdout: ${stdout}`);
                            }
                            if (stderr) {
                                console.error(`stderr: ${stderr}`);
                            }
                        });
                    });
                });
            } else {
                // set route
                exec('sudo route add -net ' + host_arr[0] + '.' + host_arr[1] + '.' + host_arr[2] + '.0 netmask 255.255.255.0 gw ' + my_rf_address, (error, stdout, stderr) => {
                    if (error) {
                        console.error(`[error] in routing table setting : ${error}`);
                        return;
                    }
                    if (stdout) {
                        console.log(`stdout: ${stdout}`);
                    }
                    if (stderr) {
                        console.error(`stderr: ${stderr}`);
                    }
                    exec('route', (error, stdout, stderr) => {
                        if (error) {
                            console.error(`[error] in routing table setting : ${error}`);
                            return;
                        }
                        if (stdout) {
                            console.log(`stdout: ${stdout}`);
                        }
                        if (stderr) {
                            console.error(`stderr: ${stderr}`);
                        }
                    });
                });
            }
        } else {
            setTimeout(setIPandRoute, 500, my_rf_address);
        }
    } else {
        setTimeout(setIPandRoute, 500, my_rf_address);
    }
}

function udp_connect(address, port) {
    if (UDP_client === null) {
        UDP_client = dgram.createSocket('udp4');
        UDP_client.bind(parseInt(port) + 2);

        UDP_client.on('listening', udpListening);
        UDP_client.on('close', udpClose);
        UDP_client.on('error', udpError);
        UDP_client.on('message', udpMessage);
    }
}

function udpError(err) {
    console.log(`[UDP_client] error:\n${err.stack}`);
    UDP_client.close();
    setTimeout(udp_connect, 2000);
}

function udpClose() {
    console.log('[UDP_client] close');

    setTimeout(udp_connect, 2000);
}

function udpListening() {
    const address = UDP_client.address();
    console.log(`[UDP_client] listening ${address.address}:${address.port}`);
}

function udpMessage(msg, rinfo) {
    // console.log('[udpMessage] ' + msg.toString('hex') + ' From ' + rinfo.address + ':' + rinfo.port);
    let UDPData = msg.toString('hex');

    let header = UDPData.substr(0, 2);
    if (header === 'fe') {
        tas_mav.gcs_noti_handler(msg);
    }
}

