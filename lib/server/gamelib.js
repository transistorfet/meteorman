
'use strict';


if (Meteor.isServer) {

    Meteor.publish('GameTypes', function() {
        for (var name in GameLib.Types.games) {
            this.added('GameTypes', Random.id(), GameLib.Types.find(name));
        }
        this.ready();
    });

    Meteor.publish('MyGamesList', function() {
        return GameState.find({ users: { $in: [ this.userId ] } }, { fields: { createdAt: 1, gametype: 1, users: 1, invites: 1, options: 1, started: 1 } });
    });

    Meteor.publish('OpenGamesList', function() {
        //return GameState.find({ 'options.slots': { $elemMatch: { type: 'open', userId: '' } } }, { fields: { createdAt: 1, gametype: 1, options: 1, users: 1, started: 1 } });
        // TODO you need to filter this better
        return GameState.find({ $where: "this.options.openslots - (this.users.length - this.invites.length) > 0" }, { fields: { createdAt: 1, gametype: 1, users: 1, invites: 1, options: 1, started: 1 } });
    });

    Meteor.publish('CurrentGameData', function(gameId) {
        var self = this;

        var getData = function(gameId) {
            var game = GameState.findOne({ _id: gameId, users: { $in: [ self.userId ] } }, { fields: { gametype: 1, users: 1, invites: 1, options: 1, started: 1, logs: 1 } });
            if (!game)
                return null;
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



    Meteor.methods({
        newGame: function (gametype, options) {
            var userId = Meteor.userId();

            if (!userId)
                throw new Meteor.Error('not-authorized');

            var gameinfo = GameLib.Types.find(gametype);
            if (!gameinfo)
                throw new Meteor.Error('invalid-game-type');

            if (GameState.find({ users: { $in: [ userId ] } }).count() >= 10)
                throw new Meteor.Error('too-many-games');

            var game = {
                createdBy: userId,
                createdAt: Date.now() / 1000,
                gametype: gametype,
                options: options,
                users: [ Meteor.userId() ],
                invites: [ Meteor.userId() ],
                started: false,
                state: { },
                logs: [ ],
            };

            /*
            var canStart = true;
            for (var i in options.slots) {
                var slot = options.slots[i];
                if (slot.type == 'local') {
                    slot.userId = Meteor.userId();
                    game.users.push(slot.userId);
                }
                else if (slot.type == 'open' || slot.type == 'invite') {
                    canStart = false;
                    // TODO we need to delay the start of the game until the other players have joined
                }
            }
            */

            var gameId = GameState.insert(game);
            GameLib.log(gameId, "new " + gametype + " game created");

            GameLib.call('init', gameId, userId);

            if ((game.users.length + game.options.computers) >= ( game.options.waitall ? game.options.maxslots : gameinfo.minslots ))
                GameLib.start(gameId, userId);
            return gameId;
        },

        joinGame: function (gameId) {
            var user = Meteor.user();
            if (!user._id)
                throw new Meteor.Error('not-authorized');

            var game = GameState.findOne({ _id: gameId });
            var gameinfo = GameLib.Types.find(game.gametype);
            if (!game || (game.options.waitall && game.started))
                return false;

            if (game.users.indexOf(user._id) >= 0)
                throw new Meteor.Error('already-joined');

            if (game.invites.indexOf(user._id) < 0 && GameLib.openSlots(game) <= 0)
                throw new Meteor.Error('no-open-slots');

            if (!GameLib.call('playerJoin', game, user._id))
                throw new Meteor.Error('error-joining-game');
            GameState.update({ _id: gameId }, { $push: { users: user._id } });
            console.log('joined', game);

            /*
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
            */

            if (!game.started && (game.users.length + game.options.computers) >= ( game.options.waitall ? game.options.maxslots : gameinfo.minslots ))
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

                /*
                game.options.slots.some(function (current, index, array) {
                    if (current.userId == userId) {
                        current.userId = '';
                        current.name = '';
                        return true;
                    }
                });
                GameState.update({ _id: gameId }, { $pull: { users: userId }, $set: { 'options.slots': game.options.slots } });
                */

                GameState.update({ _id: gameId }, { $pull: { users: userId } });
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

        chat: function (gameId, text) {
            if (text)
                GameLib.log(gameId, '<' + Meteor.user().username + '> ' + text);
        },
    });


    global.GameLib = {
        start: function (gameId, userId) {
            GameLib.log(gameId, "starting game");
            GameLib.call('start', gameId, userId);
            GameState.update({ _id: gameId }, { $set: { started: true } });
        },

        find: function (gameId, userId) {
            var selector = { _id: gameId };
            if (userId)
                selector[users] = { $in: [ userId ] };
            return GameState.findOne(selector);
        },

        call: function (name, gameId, userId, ...args) {
            var game = (typeof gameId == 'string') ? GameState.findOne({ _id: gameId, users: { $in: [ userId ] } }, { fields: { gametype: 1, users: 1, invites: 1, options: 1, state: 1 } }) : gameId;
            if (!game)
                throw new Meteor.Error('no-game-found');

            var methods = GameLib.Types.getMethods(game.gametype);
            args.unshift(userId);
            //args.unshift(game);
            //console.log('object', Object.create(methods));
            //Object.setPrototypeOf(game, methods);
            //console.log('game', game);
            //return game[name].apply(game, args);

            var gameobj = Object.create(methods);
            for (var key in game)
                gameobj[key] = game[key];
            //gameobj._id = game._id;
            //gameobj.options = game.options;
            //gameobj.state = game.state;
            return gameobj[name].apply(gameobj, args);

            //return methods[name].apply(methods, args);
        },

        log: function (gameId, text) {
            GameState.update({ _id: gameId }, { $push: { logs: '[' + GameUtils.formatTime(new Date()) + '] ' + text } });
        },

        updateState: function (gameId, state) {
            GameState.update({ _id: gameId }, { $set: { state: state } });
        },

        openSlots: function (game) {
            return game.options.openslots - (game.users.length - game.invites.length);
        },


        Types: {
            games: [ ],
            add: function (options) {
                if (!options.name || !options.template || !options.methods)
                    throw new Meteor.Error('invalid-game-type', "A game type definition must have a name, template, and methods object");

                var name = options.name;
                options.minslots = options.minslots || 1;
                options.maxslots = options.maxslots || 1;
                options.allowjoins = 'allowjoins' in options ? options.allowjoins : false;

                GameLib.Types.games[name] = options;
            },

            find: function (gametype) {
                return GameLib.Types.games[gametype];
            },

            getTemplate: function (gametype) {
                return GameLib.Types.games[gametype].template;
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

