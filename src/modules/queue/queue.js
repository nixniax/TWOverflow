define('FarmOverflow/Queue', [
    'conf/unitTypes',
    'helper/time',
    'helper/math'
], function (UNITS, $timeHelper, $math) {
    var i18n = $filter('i18n')
    var readableMillisecondsFilter = $filter('readableMillisecondsFilter')
    var readableDateFilter = $filter('readableDateFilter')

    var listeners = {}
    var queue = []
    var sendedCommands = []
    var expiredCommands = []
    var running = false

    // privates

    function guid () {
        return Math.floor((Math.random()) * 0x1000000).toString(16)
    }

    function worldPrefix (id) {
        var wid = $model.getSelectedCharacter().getWorldId()

        return wid + '-' + id
    }

    function joinTroopsLog (units) {
        var troops = []

        for (var unit in units) {
            troops.push(unit + ': ' + units[unit]);
        }

        return troops.join(',')
    }

    function joinOfficersLog (officers) {
        var string = []

        for (var officer in officers) {
            string.push(officer)
        }

        return string.join(', ')
    }

    function updateVillageData (command, prop, _callback) {
        var coords = command[prop].coords.split('|').map(function (coord) {
            return parseInt(coord, 10)
        })

        $autoCompleteService.villageByCoordinates({
            x: coords[0],
            y: coords[1]
        }, function (villageData) {
            command[prop].id = villageData.id
            command[prop].name = villageData.name

            _callback && _callback(villageData)
        })
    }

    function checkCoords (xy) {
        return /\d{3}\|\d{3}/.test(xy)
    }

    function checkUnits (units) {
        for (var u in units) {
            return true
        }

        return false
    }

    function cleanZeroUnits (units) {
        var cleanUnits = {}

        for (var unit in units) {
            var amount = units[unit]

            if (amount === '*' || amount !== 0) {
                cleanUnits[unit] = amount
            }
        }

        return cleanUnits
    }

    function checkArriveTime (sendTime) {
        if ($timeHelper.gameTime() > sendTime) {
            return false
        }

        return true
    }

    function getTravelTime (origin, target, units, type, officers) {
        var army = {
            units: units,
            officers: officers
        }

        var travelTime = $armyService.calculateTravelTime(army, {
            barbarian: false,
            ownTribe: false,
            officers: officers,
            effects: false
        })

        origin = origin.split('|')
        target = target.split('|')

        var distance = $math.actualDistance({
            x: origin[0],
            y: origin[1]
        }, {
            x: target[0],
            y: target[1]
        })

        var totalTravelTime = $armyService.getTravelTimeForDistance(
            army,
            travelTime,
            distance,
            type
        )

        return totalTravelTime * 1000
    }

    function orderQueue () {
        queue = queue.sort(function (a, b) {
            return a.sendTime - b.sendTime
        })
    }

    function loadStoredCommands () {
        var storedQueue = Lockr.get(worldPrefix('queue-commands'), [], true)

        if (storedQueue.length) {
            for (var i = 0; i < storedQueue.length; i++) {
                var command = storedQueue[i]

                if ($timeHelper.gameTime() > command.sendTime) {
                    Queue.expireCommand(command)
                } else {
                    queue.push(command)
                }
            }
        }
    }

    function parseDynamicUnits (command) {
        var playerVillages = $model.getVillages()
        var village = playerVillages[command.origin.id]

        if (!village) {
            return false
        }

        var villageUnits = village.unitInfo.units
        var parsedUnits = {}

        for (var unit in command.units) {
            var amount = command.units[unit]

            if (amount === '*') {
                amount = villageUnits[unit].available

                if (amount === 0) {
                    continue
                }
            } else if (amount < 0) {
                amount = villageUnits[unit].available - Math.abs(amount)

                if (amount < 0) {
                    return false
                }
            }

            parsedUnits[unit] = amount
        }

        return parsedUnits
    }

    // publics

    var Queue = {
        version: '___commandQueueVersion'
    }

    Queue.init = function () {
        loadStoredCommands()

        sendedCommands = Lockr.get(worldPrefix('queue-sended'), [], true)
        expiredCommands = Lockr.get(worldPrefix('queue-expired'), [], true)

        setInterval(function () {
            if (!queue.length) {
                return false
            }

            var gameTime = $timeHelper.gameTime()

            for (var i = 0; i < queue.length; i++) {
                if (queue[i].sendTime - gameTime < 0) {
                    if (running) {
                        Queue.sendCommand(queue[i])
                    } else {
                        Queue.expireCommand(queue[i])
                    }
                } else {
                    break
                }
            }
        }, 250)

        window.addEventListener('beforeunload', function (event) {
            if (running && queue.length) {
                event.returnValue = true
            }
        })
    }

    Queue.trigger = function (event, args) {
        if (event in listeners && listeners[event].length) {
            listeners[event].forEach(function (handler) {
                handler.apply(this, args)
            })
        }
    }

    Queue.bind = function (event, handler) {
        if (!listeners.hasOwnProperty(event)) {
            listeners[event] = []
        }

        listeners[event].push(handler)
    }

    Queue.sendCommand = function (command) {
        command.units = parseDynamicUnits(command)

        if (!command.units) {
            return Queue.trigger('error', ['No units enought to send the attack!'])
        }

        $socket.emit($route.SEND_CUSTOM_ARMY, {
            start_village: command.origin.id,
            target_village: command.target.id,
            type: command.type,
            units: command.units,
            icon: 0,
            officers: command.officers,
            catapult_target: null
        })

        sendedCommands.push(command)
        Lockr.set(worldPrefix('queue-sended'), sendedCommands)

        Queue.removeCommand(command, 'sended')
        Queue.trigger('send', [command])
    }

    Queue.expireCommand = function (command) {
        expiredCommands.push(command)
        Lockr.set(worldPrefix('queue-expired'), expiredCommands)

        Queue.removeCommand(command, 'expired')
    }

    Queue.addCommand = function (command) {
        if (!command.origin || !command.target) {
            return Queue.trigger('error', ['Origin/target has errors.'])
        }

        if (!checkCoords(command.origin)) {
            return Queue.trigger('error', ['Origin coords format ' + origin + ' is invalid.'])
        }

        if (!checkCoords(command.target)) {
            return Queue.trigger('error', ['Origin coords format ' + target + ' is invalid.'])
        }

        if (!checkUnits(command.units)) {
            return Queue.trigger('error', ['You need to specify an amount of units.'])
        }

        command.units = cleanZeroUnits(command.units)

        var arriveTime = new Date(command.arrive).getTime()
        var travelTime = getTravelTime(command.origin, command.target, command.units, command.type)
        var sendTime = arriveTime - travelTime

        if (!checkArriveTime(sendTime)) {
            return Queue.trigger('error', ['This command should have already exited.'])
        }

        // transform "true" to 1 because the game do like that
        for (var officer in command.officers) {
            command.officers[officer] = 1
        }

        command.id = guid()
        command.sendTime = sendTime
        command.travelTime = travelTime
        command.origin = { coords: command.origin, name: null, id: null }
        command.target = { coords: command.target, name: null, id: null }

        var updateOrigin = new Promise(function (resolve, reject) {
            updateVillageData(command, 'origin', function (villageData) {
                if (!villageData.hasOwnProperty('id')) {
                    return reject('Origin village does not exist.')
                }

                resolve()
            })
        })

        var updateTarget = new Promise(function (resolve, reject) {
            updateVillageData(command, 'target', function (villageData) {
                if (!villageData.hasOwnProperty('id')) {
                    return reject('Target village does not exist.')
                }

                resolve()
            })
        })

        Promise.all([updateOrigin, updateTarget])
            .then(function () {
                queue.push(command)
                orderQueue()
                Lockr.set(worldPrefix('queue-commands'), queue)
                Queue.trigger('add', [command])
            })
            .catch(function (error) {
                Queue.trigger('error', [error])
            })
    }

    Queue.removeCommand = function (command, reason) {
        for (var i = 0; i < queue.length; i++) {
            if (queue[i].id == command.id) {
                queue.splice(i, 1)

                if (reason === 'expired') {
                    Queue.trigger('expired', [command])
                } else if (reason === 'removed') {
                    Queue.trigger('remove', [true, command, true /*manual*/])
                }

                Lockr.set(worldPrefix('queue-commands'), queue)

                return true
            }
        }

        Queue.trigger('remove', [false])
        
        return false
    }

    Queue.clearRegisters = function () {
        Lockr.set(worldPrefix('queue-expired'), [])
        Lockr.set(worldPrefix('queue-sended'), [])
        expiredCommands = []
        sendedCommands = []
    }

    Queue.start = function (firstRun) {
        running = true
        Queue.trigger('start', [firstRun])
    }

    Queue.stop = function () {
        running = false
        Queue.trigger('stop')
    }

    Queue.isRunning = function () {
        return !!running
    }

    Queue.getCommands = function () {
        return queue
    }

    Queue.getSended = function () {
        return sendedCommands
    }

    Queue.getExpired = function () {
        return expiredCommands
    }

    return Queue
})