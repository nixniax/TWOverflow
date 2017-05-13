define('FarmOverflow/Interface', [
    'helper/time',
    'queues/EventQueue',
    'FarmOverflow/FrontButton'
], function ($timeHelper, $eventQueue, FrontButton) {
    /**
     * @class
     *
     * @param {Object} farmOverflow - Instância do FarmOverflow para integração.
     */
    function Interface (farmOverflow) {
        this.farmOverflow = farmOverflow
        this.newSettings = {}
        this.activeTab = 'info'
        this.events = Lockr.get('lastEvents', [], true)
        this.eventCount = 1

        this.buildStyle()
        this.buildWindow()
        this.bindTabs()
        this.bindSettings()
        this.bindEvents()
        this.updateGroupList()
        this.populateEvents()

        farmOverflow.on('presetsLoaded', () => {
            this.updatePresetList()
        })
        
        if ($presetList.isLoaded()) {
            this.updatePresetList()
        }

        farmOverflow.on('presetsChange', () => {
            this.updatePresetList()
        })

        farmOverflow.on('groupsChanged', () => {
            this.updateGroupList()
        })

        this.$close.on('click', () => {
            this.closeWindow()
        })

        $hotkeys.add('esc', () => {
            this.closeWindow()
        }, ['INPUT', 'SELECT', 'TEXTAREA'])

        $root.$on($eventType.WINDOW_CLOSED, () => {
            this.closeWindow()
        })

        this.farmButton.click(() => {
            this.openWindow()
        })

        this.$start.on('click', () => {
            farmOverflow.switch()
        })

        $hotkeys.add(farmOverflow.settings.hotkeySwitch, () => {
            farmOverflow.switch()
        })

        $hotkeys.add(farmOverflow.settings.hotkeyWindow, () => {
            this.openWindow()
        })

        farmOverflow.on('start', () => {
            this.$start.html(farmOverflow.lang.general.pause)
            this.$start.removeClass('btn-green').addClass('btn-red')
            this.farmButton.$elem.removeClass('btn-green').addClass('btn-red')
        })

        farmOverflow.on('pause', () => {
            this.$start.html(farmOverflow.lang.general.start)
            this.$start.removeClass('btn-red').addClass('btn-green')
            this.farmButton.$elem.removeClass('btn-red').addClass('btn-green')
        })

        return this
    }

    /**
     * Popula a lista de eventos que foram gerados em outras execuções
     * do FarmOverflow.
     */
    Interface.prototype.populateEvents = function () {
        let settings = this.farmOverflow.settings
        
        // Caso tenha algum evento, remove a linha inicial "Nada aqui ainda"
        if (this.events.length > 0) {
            this.$events.html('')
        }

        for (let i = 0; i < this.events.length; i++) {
            if (this.eventCount >= settings.eventsLimit) {
                break
            }

            let event = this.events[i]

            if (!settings.eventAttack && event.type === 'sendCommand') {
                continue
            }

            if (!settings.eventVillageChange && event.type === 'nextVillage') {
                continue
            }

            if (!settings.eventPriorityAdd && event.type === 'priorityTargetAdded') {
                continue
            }

            if (!settings.eventIgnoredVillage && event.type === 'ignoredVillage') {
                continue
            }

            this.addEvent(event, true)
        }
    }

    /**
     * Injeta o CSS.
     */
    Interface.prototype.buildStyle = function () {
        this.$style = document.createElement('style')
        this.$style.type = 'text/css'
        this.$style.id = 'farmOverflow-style'
        this.$style.innerHTML = '___cssStyle'

        document.querySelector('head').appendChild(this.$style)
    }

    /**
     * Injeta a estrutura.
     */
    Interface.prototype.buildWindow = function () {
        this.$wrapper = $('#wrapper')

        this.$window = document.createElement('section')
        this.$window.id = 'farmOverflow-window'
        this.$window.className = 'farmOverflow-window twx-window screen left'

        let replaces = angular.merge({
            version: this.farmOverflow.version,
            author: ___author
        }, this.farmOverflow.lang)

        let html = TemplateEngine('___htmlFarmWindow', replaces)

        this.$window.innerHTML = html
        this.$wrapper.append(this.$window)

        this.farmButton = new FrontButton({
            label: 'Farm',
            classHover: 'farmOverflow-show-status',
            classBlur: 'farmOverflow-hide-status',
            hoverText: () => {
                let translate = this.farmOverflow.lang.events.lastAttack
                return translate + ': ' + this.$last.html()
            }
        })

        this.$scrollbar = jsScrollbar(this.$window.querySelector('.win-main'))
        this.$settings = $('#farmOverflow-settings')
        this.$save = $('#farmOverflow-save')
        this.$start = $('#farmOverflow-start')
        this.$close = $('#farmOverflow-close')
        this.$preset = $('#farmOverflow-preset')
        this.$groupIgnore = $('#farmOverflow-ignore')
        this.$groupInclude = $('#farmOverflow-include')
        this.$groupOnly = $('#farmOverflow-only')
        this.$language = $('#farmOverflow-language')
        this.$events = $('#farmOverflow-events')
        this.$status = $('#farmOverflow-status')
        this.$last = $('#farmOverflow-last')
        this.$selected = $('#farmOverflow-selected')

        this.updateLastAttack()
        this.updateSelectedVillage()
    }

    /**
     * Atualiza o elemento com a data do último ataque enviado
     * Tambem armazena para ser utilizado nas proximas execuções.
     */
    Interface.prototype.updateLastAttack = function (lastAttack) {
        if (!lastAttack) {
            lastAttack = this.farmOverflow.lastAttack

            if (lastAttack === -1) {
                return
            }
        }

        let readable = $filter('readableDateFilter')(lastAttack)
        let langLast = this.farmOverflow.lang.events.lastAttack

        this.$last.html(readable)
        this.farmButton.updateHoverText(langLast + ': ' + readable)
    }

    /**
     * Atualiza o elemento com a aldeias atualmente selecionada
     */
    Interface.prototype.updateSelectedVillage = function () {
        let selected = this.farmOverflow.village

        if (!selected) {
            this.$selected.html(this.farmOverflow.lang.general.none)

            return false
        }

        let village = createButtonLink(
            'village',
            `${selected.name} (${selected.x}|${selected.y})`,
            this.farmOverflow.village.id
        )

        this.$selected.html('')
        this.$selected.append(village.elem)
    }

    /**
     * Abrir janela.
     */
    Interface.prototype.openWindow = function () {
        $wms.closeAll()

        this.$window.style.visibility = 'visible'
        this.$wrapper.addClass('window-open')

        $eventQueue.trigger($eventQueue.types.RESIZE, {
            'instant': true,
            'right': true
        })
    }

    /**
     * Fecha janela.
     */
    Interface.prototype.closeWindow = function () {
        this.$window.style.visibility = 'hidden'
        this.$wrapper.removeClass('window-open')

        $eventQueue.trigger($eventQueue.types.RESIZE, {
            'instant': true,
            'right': true
        })
    }

    /**
     * Altera o estado da janela.
     *
     * @param {String} state - Estado da visibilidade (hidden || visible)
     */
    Interface.prototype.toggleWindow = function (state) {
        this.$window.style.visibility = state
        this.$wrapper.toggleClass('window-open')

        $eventQueue.trigger($eventQueue.types.RESIZE, {
            'instant': true,
            'right': true
        })
    }

    /**
     * Controla o estado das abas.
     */
    Interface.prototype.tabsState = function () {
        for (let $tab of this.$tabs) {
            let name = $tab.getAttribute('tab')

            let $content = this.$window.querySelector(`.farmOverflow-content-${name}`)
            let $button = this.$window.querySelector(`.farmOverflow-button-${name}`)
            let $inner = $tab.querySelector('.tab-inner > div')
            let $a = $tab.querySelector('a')

            if (this.activeTab === name) {
                $content.style.display = ''
                $tab.classList.add('tab-active')
                $inner.classList.add('box-border-light')
                $a.classList.remove('btn-icon', 'btn-orange')

                if ($button) {
                    $button.style.display = ''
                }

                this.$scrollbar.content = $content
            } else {
                $content.style.display = 'none'
                $tab.classList.remove('tab-active')
                $inner.classList.remove('box-border-light')
                $a.classList.add('btn-icon', 'btn-orange')

                if ($button) {
                    $button.style.display = 'none'
                }
            }

            this.$scrollbar.recalc()
        }
    }

    /**
     * Listener das abas.
     */
    Interface.prototype.bindTabs = function () {
        this.$tabs = this.$window.querySelectorAll('.tab')

        for (let tab of this.$tabs) {
            let name = tab.getAttribute('tab')
            
            tab.addEventListener('click', () => {
                this.activeTab = name
                this.tabsState()
            })
        }

        this.tabsState()
    }

    /**
     * Loop em todas configurações do FarmOverflow
     * @param {Function} callback
     */
    Interface.prototype.eachSetting = function (callback) {
        for (let key in this.farmOverflow.settings) {
            let $input = $(`[name="${key}"]`, this.$window)

            if (!$input.length) {
                continue
            }

            callback($input)
        }
    }

    /**
     * Listeners das para alteração das configurações do FarmOverflow.
     */
    Interface.prototype.bindSettings = function () {
        let checkedClass = 'icon-26x26-checkbox-checked'

        // Insere os valores nas entradas
        this.eachSetting(($input) => {
            let type = $input[0].type
            let name = $input[0].name

            if (type === 'select-one') {
                if (name === 'language') {
                    $input[0].value = this.farmOverflow.settings.language
                }

                return
            }

            if (type === 'checkbox') {
                if (this.farmOverflow.settings[name]) {
                    $input[0].checked = true
                    $input.parent().addClass(checkedClass)
                }

                $input.on('click', () => {
                    $input.parent().toggleClass(checkedClass)
                })

                return
            }

            $input.val(this.farmOverflow.settings[name])
        })

        // Quarda os valores quando salvos
        this.$settings.on('submit', (event) => {
            event.preventDefault()

            if (this.$settings[0].checkValidity()) {
                let settings = {}

                this.eachSetting(($input) => {
                    let name = $input[0].name
                    let type = $input[0].type
                    let value = $input.val()

                    if ($input[0].type === 'number') {
                        value = parseInt(value, 10)
                    }

                    settings[name] = value
                })

                this.farmOverflow.updateSettings(settings)
                this.farmOverflow.notif('success', this.farmOverflow.lang.settings.saved)
            }

            return false
        })

        this.$save.on('click', (event) => {
            this.$settings.find('input:submit')[0].click()
        })
    }

    /**
     * Adiciona um evento na aba "Eventos".
     *
     * @param {Object} options - Opções do evento.
     * @param {Boolean} [_populate] - Indica quando o script está apenas populando
     *      a lista de eventos, então não é alterado o "banco de dados".
     */
    Interface.prototype.addEvent = function (options, _populate) {
        let limit = this.farmOverflow.settings.eventsLimit

        if (this.eventCount >= limit) {
            this.$events.find('tr:last-child').remove()
        }

        if (this.events.length >= limit) {
            this.events.pop()
        }

        this.addRow(this.$events, options, _populate)
        this.eventCount++

        if (!_populate) {
            options.timestamp = $timeHelper.gameTime()
            this.events.unshift(options)
            
            Lockr.set('lastEvents', this.events)
        }
    }

    /**
     * Adiciona uma linha (tr) com links internos do jogo.
     *
     * @param {Object} options
     * @param {Boolean} [_populate] - Indica quando o script está apenas populando
     *      a lista de eventos, então os elementos são adicionados no final da lista.
     */
    Interface.prototype.addRow = function ($where, options, _populate) {
        let links = []

        // Copia o objeto porque ele será armazenado e não queremos os
        // dados guardados já renderizados.
        options = angular.copy(options)

        if (options.links) {
            for (let i = 0; i < options.links.length; i++) {
                links.push(createButtonLink(
                    options.links[i].type,
                    options.links[i].name
                ))
            }

            if (!options.type) {
                options.text = sprintf(options.text, links)
            } else {
                options.text = sprintf(this.farmOverflow.lang.events[options.type], links)
            }
        }

        let $tr = document.createElement('tr')

        $tr.className = 'reduced'
        $tr.innerHTML = TemplateEngine('___htmlFarmEvent', {
            date: $filter('readableDateFilter')(options.timestamp || $timeHelper.gameTime()),
            icon: options.icon,
            text: options.text
        })

        if (!options.icon) {
            $tr.querySelector('.icon-bg-black').remove()
            $tr.querySelector('.text-tribe-news').className = ''
        }

        if (options.links) {
            for (let i = 0; i < links.length; i++) {
                options.links[i].elem = $tr.querySelector('#' + links[i].id)
                options.links[i].elem.addEventListener('click', function () {
                    $wds.openVillageInfo(options.links[i].id)
                })
            }
        }

        $where[_populate ? 'append' : 'prepend']($tr)
        this.$scrollbar.recalc()
    }

    /**
     * Atualiza a lista de presets na aba de configurações.
     */
    Interface.prototype.updatePresetList = function () {
        let loaded = {}
        let presets = $model.getPresetList().presets
        
        this.$preset.html(
            `<option value="">${this.farmOverflow.lang.general.disabled}</option>`
        )

        for (let id in presets) {
            let cleanName = presets[id].name.replace(rpreset, '').trim()

            if (cleanName in loaded) {
                continue
            }

            // presets apenas com descrição sem identificação são ignorados
            if (!cleanName) {
                continue
            }

            let selected = ''

            if (this.farmOverflow.settings.presetName === cleanName) {
                selected = 'selected'
            }

            this.$preset.append(
                `<option value="${cleanName}" ${selected}>${cleanName}</option>`
            )

            loaded[cleanName] = true
        }
    }

    /**
     * Atualiza a lista de grupos na aba de configurações.
     */
    Interface.prototype.updateGroupList = function () {
        let types = ['groupIgnore', 'groupInclude', 'groupOnly']
        let groups = $model.getGroupList().getGroups()

        for (let type of types) {
            let $type = '$' + type

            this[$type].html(
                `<option value="">${this.farmOverflow.lang.general.disabled}</option>`
            )

            for (let id in groups) {
                let name = groups[id].name
                let selected = ''

                if (this.farmOverflow.settings[type] == id) {
                    selected = 'selected'
                }

                this[$type].append(
                    `<option value="${id}" ${selected}>${name}</option>`
                )
            }
        }
    }

    /**
     * Adiciona eventos na interface com base nos eventos do FarmOverflow.
     */
    Interface.prototype.bindEvents = function () {
        let settings = this.farmOverflow.settings

        let events = {
            sendCommand: (from, to) => {
                this.$status.html(this.farmOverflow.lang.events.attacking)
                this.updateLastAttack($timeHelper.gameTime())

                if (!settings.eventAttack) {
                    return false
                }

                let labelFrom = `${from.name} (${from.x}|${from.y})`
                let labelTo = `${to.name} (${to.x}|${to.y})`

                this.addEvent({
                    links: [
                        { type: 'village', name: labelFrom, id: from.id },
                        { type: 'village', name: labelTo, id: to.id }
                    ],
                    icon: 'attack-small',
                    type: 'sendCommand'
                })
            },
            nextVillage: (next) => {
                this.updateSelectedVillage()
                
                if (!settings.eventVillageChange) {
                    return false
                }

                let labelNext = `${next.name} (${next.x}|${next.y})`

                this.addEvent({
                    links: [
                        { type: 'village', name: labelNext, id: next.id }
                    ],
                    icon: 'village',
                    type: 'nextVillage'
                })
            },
            ignoredVillage: (target) => {
                if (!settings.eventIgnoredVillage) {
                    return false
                }

                let label = `${target.name} (${target.x}|${target.y})`

                this.addEvent({
                    links: [
                        { type: 'village', name: label, id: target.id }
                    ],
                    icon: 'check-negative',
                    type: 'ignoredVillage'
                })
            },
            priorityTargetAdded: (target) => {
                if (!settings.eventPriorityAdd) {
                    return false
                }
                
                let label = `${target.name} (${target.x}|${target.y})`

                this.addEvent({
                    links: [
                        { type: 'village', name: label, id: target.id }
                    ],
                    icon: 'parallel-recruiting',
                    type: 'priorityTargetAdded'
                })
            },
            noPreset: () => {
                this.addEvent({
                    icon: 'info',
                    type: 'noPreset'
                })

                this.$status.html(this.farmOverflow.lang.events.paused)
            },
            noUnits: () => {
                if (this.farmOverflow.singleVillage) {
                    this.$status.html(this.farmOverflow.lang.events.noUnits)
                }
            },
            noUnitsNoCommands: () => {
                this.$status.html(this.farmOverflow.lang.events.noUnitsNoCommands)
            },
            start: () => {
                this.$status.html(this.farmOverflow.lang.events.attacking)
            },
            pause: () => {
                this.$status.html(this.farmOverflow.lang.events.paused)
            },
            noVillages: () => {
                this.$status.html(this.farmOverflow.lang.events.noVillages)
            },
            villagesUpdate: () => {
                this.updateSelectedVillage()
            },
            startLoadingTargers: () => {
                this.$status.html(this.farmOverflow.lang.events.loadingTargets)
            },
            endLoadingTargers: () => {
                this.$status.html(this.farmOverflow.lang.events.analyseTargets)
            },
            attacking: () => {
                this.$status.html(this.farmOverflow.lang.events.attacking)
            },
            commandLimitSingle: () => {
                this.$status.html(this.farmOverflow.lang.events.commandLimit)
            },
            commandLimitMulti: () => {
                this.$status.html(this.farmOverflow.lang.events.noVillages)
            },
            resetEvents: () => {
                this.eventCount = 0
                this.populateEvents()
            }
        }

        for (let type in events) {
            this.farmOverflow.on(type, events[type])
        }
    }

    return Interface
})
