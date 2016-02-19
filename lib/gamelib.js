
'use strict';
var Global = Meteor.isClient ? window : global;


Global.GameState = new Mongo.Collection('gamestate');


if (Meteor.isClient) {

    window.GameTypes = new Mongo.Collection('GameTypes');
    Meteor.subscribe('GameTypes');

    Meteor.subscribe('UserGamesList');

    window.CurrentGameData = new Mongo.Collection('CurrentGameData');

    Template.registerHelper('equals', function (arg1, arg2) {
        return (arg1 == arg2);
    });

    Template.registerHelper('isUserId', function (userId) {
        return (userId == Meteor.userId());
    });

    Template.registerHelper('truncate', function (value, length) {
        return value.substring(0, length);
    });

    Template.registerHelper('attributeUserId', function (userId) {
        if (userId == Meteor.userId())
            return { id: 'players-card' };
        return null;
    });

    Template.registerHelper('myGameList', function () {
        return GameState.find({ users: { $in: [ Meteor.userId() ] } }).fetch();
    });

    Template.registerHelper('gameTypeList', function () {
        return GameTypes.find({});
    });

    var RandomNames = [
        "Mr.Computer",
        "Mr.Bigglesworth",
        "MissTickles",
        "MrsMymind",
        "CaptainPants",
        "DirkGently",
        "ChairmanMeow",
        "Dr.FluffyPants",
        "CountCatula",
        "TheJabberwock",
        "DangerousDim",
        "Sgt.Circuit",
        "PresidentPrettyPants",
    ];

    Template.registerHelper('randomName', function () {
        return RandomNames[Math.floor(Math.random() * RandomNames.length)];
    });


    // New Game - Select Type
    Router.route('/play/new', function () {
        if (!Meteor.userId())
            this.redirect('/')
        this.render('GameSelectType');
    });

    // New Game - Specify Game Options
    Router.route('/play/new/:gametype', function () {
        console.log('new game route ', this);
        if (!Meteor.userId())
            this.redirect('/')

        /*
        var games = GameState.find({ gametype: this.params.gametype }, { fields: { _id: 1 } }).fetch();
        if (games.length > 0) {
            console.log('existing game ', this);
            FlashMessages.sendInfo("A game of that type is already in progress. Quit this game first to start a new one.");
            this.redirect('/play/' + games[0]._id);
        }
        else {
            var gameinfo = GameTypes.findOne({ name: this.params.gametype });
            this.render('GameConfigure', { data: gameinfo });
        }
        */

        var gameinfo = GameTypes.findOne({ name: this.params.gametype });
        this.render('GameConfigure', { data: gameinfo });
    });

    Template.GameConfigure.helpers({
        slotsList: function () {
            var slots = [ ];
            for (var i = 1; i < this.maxslots; i++)
                slots[i] = { num: i + 1, required: i < this.minslots };
            return slots;
        },
    });

    Template.GameConfigure.events({
        'change #game-add-players select': function (event) {
            var $target = $(event.currentTarget).parent().find('input[name="name"]');
            if (event.currentTarget.value == 'computer') {
                $target.val(RandomNames[Math.floor(Math.random() * RandomNames.length)]);
                $target.show();
            }
            else if (event.currentTarget.value == 'invite') {
                $target.val('');
                $target.show();
            }
            else {
                $target.hide();
            }
        },

        'click #game-begin': function () {
            FlashMessages.clear();

            var options = { };
            options.slots = [ ];
            $('#game-add-players li').each(function () {
                var slot = $(this).attr('data-slot');
                var type = $(this).find('select[name="type"]').val() || 'local';
                if (type != 'empty') {
                    var info = { };
                    info.slot = slot;
                    info.type = type;

                    if (type == 'local')
                        info.name = Meteor.user().username;
                    else if (type == 'open')
                        info.name = '';
                    else
                        info.name = $(this).find('input[name="name"]').val();

                    options.slots.push(info);
                }
            });

            if (options.slots.length < this.minslots) {
                FlashMessages.sendInfo("You must configure the minimum required players.");
            }
            else {
                console.log(options);
                Meteor.call('newGame', this.name, options, function (error, result) {
                    console.log('making new game ', result);
                    Router.go('/play/' + result);
                });
            }
        },
    });


    // Waiting for Game to Start
    Template.GameWaiting.helpers({
        isWaiting: function (slot) {
            return (slot.type != 'computer' && !slot.userId);
        },
    });

    Template.GameWaiting.events({
        'click .game-slot-cancel': function (event, template) {
            if (confirm("Are you sure you want to close this player slot?")) {

            }
        },
    });


    // Find Open Games
    Router.route('/play/find', {
        action: function () {
            console.log('find game ', this);
            if (!Meteor.userId())
                this.redirect('/')

            var list = GameState.find({ users: { $nin: [ Meteor.userId() ] } });
            this.render('GameFind', { data: { list: list } });
        },

        waitOn: function () {
            this.subscribe('OpenGamesList');
        },
    });

    Template.GameFind.events({
        'click .game-join': function (event, template) {
            var gameId = $(event.target).attr('data-id');
            if (gameId) {
                Meteor.call('joinGame', gameId, function (error, result) {
                    if (result)
                        Router.go('/play/' + gameId);
                    else
                        FlashMessages.sendInfo("An error occurred while attempting to join this game.");
                });
            }
        },
    });


    // Play The Game
    Router.route('/play/:gameId', {

        action: function () {
            console.log('play game id ', this);
            if (!Meteor.userId())
                this.redirect('/')

            /*
            var game = GameState.findOne({ _id: this.params.gameId });
            var gameinfo = GameTypes.findOne({ name: game.gametype });
            game.title = gameinfo.title;
            game.state = CurrentGameData.findOne({});
            game.template = gameinfo.template;
            console.log(game);
            this.render(gameinfo.template, { data: game });
            */
            this.render('GameArea', { data: { gameId: this.params.gameId } });
        },

        waitOn: function () {
            //console.log(this);
            this.subscribe('CurrentGameData', this.params.gameId);
        },
    });

    /*
    Template.GameArea.onRendered(function () {
        var instance = this;
        this.autorun(function () {
            console.log('poops', Template.instance());
            Tracker.afterFlush(function () {
                var element = $('#game-logs')[0];
                console.log(element);
                element.scrollTop = element.scrollTopMax;
            });
        });
    });
    */

    Template.GameArea.helpers({
        GameData: function (gameId) {
            /*
            var game = GameState.findOne({ _id: gameId });
            if (game === undefined) {
                //Router.go('/');
                return { };
            }

            var gameinfo = GameTypes.findOne({ name: game.gametype });
            game.title = gameinfo.title;
            game.template = gameinfo.template;
            game.view = CurrentGameData.findOne({});
            console.log('game template', game);
            return { template: game.template, data: game };
            */

            var game = CurrentGameData.findOne({ _id: gameId });
            if (!game)
                return { };

            var gameinfo = GameTypes.findOne({ name: game.gametype });
            game.title = gameinfo.title;
            game.template = gameinfo.template;
            console.log('game template', game);
            return { template: game.template, data: game };
        },

        scrollLogs: function () {
            Tracker.afterFlush(function () {
                var element = $('#game-logs')[0];
                element.scrollTop = element.scrollTopMax;
            });
        },
    });

    Template.GameOptions.events({
        'click #game-options-quit': function () {
            // TODO ask for confirmation
            Meteor.call('quitGame', this.data._id);
            Router.go('/');
        },
    });

}

if (Meteor.isServer) {

    Meteor.publish('GameTypes', function() {
        for (var name in GameLib.Types.games) {
            this.added('GameTypes', Random.id(), GameLib.Types.getInfo(name));
        }
        this.ready();
    });

    Meteor.publish('UserGamesList', function() {
        return GameState.find({ users: { $in: [ this.userId ] } }, { fields: { createdAt: 1, gametype: 1, options: 1, users: 1, started: 1 } });
    });

    Meteor.publish('OpenGamesList', function() {
        return GameState.find({ 'options.slots': { $elemMatch: { type: 'open', userId: '' } } }, { fields: { createdAt: 1, gametype: 1, options: 1, users: 1, started: 1 } });
    });

    Meteor.publish('CurrentGameData', function(gameId) {
        var self = this;

        var getData = function(gameId) {
            var game = GameState.findOne({ _id: gameId, users: { $in: [ self.userId ] } }, { fields: { gametype: 1, options: 1, started: 1, logs: 1 } });
            if (!game)
                return null;
            //var methods = GameLib.Types.getMethods(game.gametype);
            //game.view = methods['getPlayerView'].apply(game, [ game, self.userId ]);
            game.view = game.started ? GameLib.call('getPlayerView', gameId, self.userId) : null;
            //console.log(game);
            return game;
        };

        var handle = GameState.find({ _id: gameId, users: { $in: [ this.userId ] } }).observeChanges({
            changed: function (id, fields) {
                self.changed("CurrentGameData", id, getData(id));
            }
        });

        self.onStop(function() {
            handle.stop();
        });

        //var state = GameLib.getPlayerView(this.userId, gameId);
        this.added('CurrentGameData', gameId, getData(gameId));
        this.ready();
    });

    GameState.deny({
        insert: function() {
            return true;
        },
        update: function() {
            return true;
        },
        remove: function() {
            return true;
        },
    });

    Meteor.methods({
        newGame: function (gametype, options) {
            var userId = Meteor.userId();

            if (!userId)
                throw new Meteor.Error('not-authorized');

            if (GameState.find({ owner: userId }).count() >= 10)
                throw new Meteor.Error('too-many-games');

            var game = {
                createdBy: userId,
                createdAt: Date.now() / 1000,
                gametype: gametype,
                options: options,
                users: [ ],
                started: false,
                state: { },
                logs: [ ],
            };

            var canStart = true;
            for (var i in options.slots) {
                var slot = options.slots[i];
                slot.userId = '';
                if (slot.type == 'local') {
                    slot.userId = Meteor.userId();
                    game.users.push(slot.userId);
                }
                else if (slot.type == 'open' || slot.type == 'invite') {
                    canStart = false;
                    // TODO we need to delay the start of the game until the other players have joined
                }
            }

            var gameId = GameState.insert(game);
            GameLib.log(gameId, "new " + gametype + " game created");

            if (canStart)
                GameLib.start(gameId, userId);
            return gameId;
        },

        joinGame: function (gameId) {
            var user = Meteor.user();
            if (!user._id)
                throw new Meteor.Error('not-authorized');

            var game = GameState.findOne({ _id: gameId });
            if (!game || game.started)
                return false;

            if (game.users.indexOf(user._id) >= 0)
                throw new Meteor.Error('already-joined');

            console.log('joining', game);
            var i = GameLib.findOpenSlot(game, user.username);
            if (i === false)
                return false;

            var slots = game.options.slots;

            slots[i].userId = user._id;
            slots[i].name = user.username;
            GameState.update({ _id: gameId }, { $push: { users: user._id }, $set: { 'options.slots': slots } });

            for (var i in slots)
                if (!slots[i].userId && slots[i].type != 'computer')
                    return true;

            GameLib.start(gameId, user._id);
            return true;
        },

        quitGame: function (gameId) {
            var userId = Meteor.userId();
            if (!userId)
                throw new Meteor.Error('not-authorized');

            var game = GameState.findOne({ _id: gameId, users: { $in: [ userId ] } });
            if (!game)
                return false;

            if (game.users.length > 1) {
                if (!GameLib.call('playerQuit', game, userId))
                    throw new Meteor.Error('error-quitting-game');

                var slots = game.options.slots;
                for (var i in slots) {
                    if (slots[i].userId == userId) {
                        slots[i].userId = '';
                        slots[i].name = '';
                        break;
                    }
                }

                GameState.update({ _id: gameId }, { $pull: { users: userId }, $set: { 'options.slots': game.options.slots } });
            }
            else {
                GameLib.call('finish', game, userId);
                GameState.remove({ _id: gameId, users: { $in: [ userId ] } });
            }
        },

        action: function (gameId, action, args) {
            if (!Meteor.userId())
                throw new Meteor.Error('not-authorized');
            return GameLib.call('action', gameId, Meteor.userId(), action, args);
        },
    });


    global.GameLib = {
        start: function (gameId, userId) {
            GameLib.log(gameId, "starting game");
            GameLib.call('init', gameId, userId);
            GameState.update({ _id: gameId }, { $set: { started: true } });
        },

        find: function (gameId, userId) {
            var selector = { _id: gameId };
            if (userId)
                selector[users] = { $in: [ userId ] };
            return GameState.findOne(selector);
        },

        call: function (name, gameId, userId, ...args) {
            var game = (typeof gameId == 'string') ? GameState.findOne({ _id: gameId, users: { $in: [ userId ] } }, { fields: { gametype: 1, options: 1, state: 1 } }) : gameId;
            if (!game)
                throw new Meteor.Error('no-game-found');

            var methods = GameLib.Types.getMethods(game.gametype);
            args.unshift(userId);
            args.unshift(game);
            //console.log('object', Object.create(methods));
            //Object.setPrototypeOf(game, methods);
            //console.log('game', game);
            //return game[name].apply(game, args);

            var gameobj = Object.create(methods);
            gameobj._id = game._id;
            gameobj.options = game.options;
            gameobj.state = game.state;
            return gameobj[name].apply(gameobj, args);

            //return methods[name].apply(methods, args);
        },

        log: function (gameId, text) {
            GameState.update({ _id: gameId }, { $push: { logs: '[' + GameLib.formatTime(new Date()) + '] ' + text } });
        },

        updateState: function (gameId, state) {
            GameState.update({ _id: gameId }, { $set: { state: state } });
        },

        findOpenSlot: function (game, username) {
            var slot;
            for (var i in game.options.slots) {
                slot = game.options.slots[i];
                if ((slot.type == 'invite' && slot.name == username) || slot.type == 'open')
                    return i;
            }
            return false;
        },

        formatTime: function (date) {
            var hours = date.getHours();
            var minutes = date.getMinutes();
            if (hours < 10)
                hours = '0' + hours;
            if (minutes < 10)
                minutes = '0' + minutes;
            return hours + ':' + minutes;
        },

        shuffle: function (array) {
            var j, temp;

            for (var i = array.length - 1; i > 0; i -= 1) {
                j = Math.floor(Math.random() * (i + 1))
                temp = array[i]
                array[i] = array[j]
                array[j] = temp
            }
        },

        Types: {
            games: [ ],
            add: function (options) {
                if (!options.name || !options.template || !options.methods)
                    throw new Meteor.Error('invalid-game-type', "A game type definition must have a name, template, and methods object");

                var name = options.name;
                GameLib.Types.games[name] = {
                    name: name,
                    title: options.title,
                    template: options.template,
                    methods: options.methods,
                    minslots: options.minslots || 1,
                    maxslots: options.maxslots || 1,
                    configTemplate: options.configTemplate,
                };
            },

            getTemplate: function (gametype) {
                return GameLib.Types.games[gametype].template;
            },

            getInfo: function (gametype) {
                return GameLib.Types.games[gametype];
            },

            getNames: function () {
                var names = [ ];
                for (var name in GameLib.Types.games)
                    names.push(name);
                return names;
            },

            getMethods: function (gametype) {
                return GameLib.Types.games[gametype].methods;
            }
        }
    };


    Router.route('/games/:gametype/:relpath', function () {
        return ServeFile('games/' + this.params.gametype + '/public/', this.params.relpath, this.response);
    }, { where: 'server' });
}

