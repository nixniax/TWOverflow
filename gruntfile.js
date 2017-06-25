module.exports = function (grunt) {
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        concat: {
            prod: {
                src: [
                    'src/libs/lockr.js',
                    'src/header.js',
                    'src/utils.js',
                    'src/modules/farm/farm.js',
                    'src/modules/farm/commander.js',
                    'src/modules/farm/village.js',
                    'src/modules/farm/analytics.js',
                    'src/modules/farm/interface/farm.js',
                    'src/modules/queue/queue.js',
                    'src/modules/queue/analytics.js',
                    'src/modules/queue/interface/queue.js',
                    'src/interface/interface.js',
                    'src/interface/button.js',
                    'src/footer.js',
                    'src/initialize.js'
                ],
                dest: 'dist/temp/<%= pkg.name %>.js'
            }
        },
        eslint: {
            options: {
                configFile: '.eslintrc.json'
            },
            all: ['src/*.js']
        },
        less: {
            all: {
                options: {
                    compress: true,
                    ieCompat: false
                },
                files: {
                    'dist/temp/style.css': 'src/interface/style.less'
                }
            }
        },
        htmlmin: {
            all: {
                options: {
                    removeComments: true,
                    collapseWhitespace: true
                },
                files: {
                    'dist/temp/interface/button.html': 'src/interface/button.html',
                    'dist/temp/modules/farm/interface/window.html': 'src/modules/farm/interface/window.html',
                    'dist/temp/modules/farm/interface/event.html': 'src/modules/farm/interface/event.html',
                    'dist/temp/modules/queue/interface/window.html': 'src/modules/queue/interface/window.html',
                    'dist/temp/modules/queue/interface/command.html': 'src/modules/queue/interface/command.html'
                }
            }
        },
        replace: {
            all: {
                options: {
                    prefix: '___',
                    patterns: [{
                        json: {
                            title: '<%= pkg.title %>',
                            farmOverlflowVersion: '<%= pkg.farmOverlflowVersion %>',
                            commandQueueVersion: '<%= pkg.commandQueueVersion %>',
                            license: '<%= pkg.license %>',
                            author: '<%= pkg.author %>',
                            authorName: '<%= pkg.author.name %>',
                            authorEmail: '<%= pkg.author.email %>',
                            authorUrl: '<%= pkg.author.url %>',
                            date: '<%= new Date() %>',
                            build: '<%= pkg.build %>',
                            farmAnalytics: '<%= pkg.farmAnalytics %>',
                            queueAnalytics: '<%= pkg.queueAnalytics %>',

                            // script replaces
                            htmlFarmWindow: '<%= grunt.file.read("dist/temp/modules/farm/interface/window.html") %>',
                            htmlFarmEvent: '<%= grunt.file.read("dist/temp/modules/farm/interface/event.html") %>',
                            htmlQueueWindow: '<%= grunt.file.read("dist/temp/modules/queue/interface/window.html") %>',
                            htmlQueueCommand: '<%= grunt.file.read("dist/temp/modules/queue/interface/command.html") %>',
                            htmlButton: '<%= grunt.file.read("dist/temp/interface/button.html") %>',
                            cssStyle: '<%= grunt.file.read("dist/temp/style.css") %>',
                            langPt_br: '<%= grunt.file.read("src/locale/pt_br.json") %>',
                            langEn_us: '<%= grunt.file.read("src/locale/en_us.json") %>'
                        }
                    }]
                },
                files: [{
                    expand: true,
                    flatten: true,
                    src: [
                        'dist/temp/<%= pkg.name %>.js'
                    ],
                    dest: 'dist/'
                }]
            }
        },
        uglify: {
            options: {
                sourceMap: true,
                sourceMapName: 'dist/<%= pkg.name %>.map',
                banner: '/*! <%= pkg.name %>.min.js@<%= pkg.version %> | Licence <%= pkg.license %> */'
            },
            prod: {
                files: {
                    'dist/<%= pkg.name %>.min.js': 'dist/<%= pkg.name %>.js'
                }
            }
        },
        clean: {
            all: ['dist/temp']
        }
    })

    grunt.loadNpmTasks('grunt-eslint')
    grunt.loadNpmTasks('grunt-contrib-concat')
    grunt.loadNpmTasks('grunt-contrib-less')
    grunt.loadNpmTasks('grunt-contrib-htmlmin')
    grunt.loadNpmTasks('grunt-replace')
    grunt.loadNpmTasks('grunt-contrib-uglify')
    grunt.loadNpmTasks('grunt-contrib-clean')
    grunt.loadNpmTasks('grunt-contrib-copy')

    grunt.registerTask('build', [
        'eslint',
        'concat',
        'less',
        'htmlmin',
        'replace',
        'uglify',
        'clean'
    ])
}
