
'use strict';

if (Meteor.isClient) {

    window.GameTypes = new Mongo.Collection('GameTypes');
    Meteor.subscribe('GameTypes');

    Meteor.subscribe('MyGamesList');

    window.CurrentGameData = new Mongo.Collection('CurrentGameData');

    Template.registerHelper('listGameTypes', function () {
        return GameTypes.find({}, { sort: { name: 1 } });
    });

    Template.registerHelper('listMyGames', function () {
        return GameState.find({ users: { $in: [ Meteor.userId() ] } }).fetch();
    });

    Template.registerHelper('listUserGames', function (userId) {
        return GameState.find({ users: { $in: [ userId ] } }).fetch();
    });


    // New Game - Select Type
    Router.route('/play/new', function () {
        if (!Meteor.userId())
            this.redirect('/')
        this.render('GameSelectType');
    });

    // New Game - Specify Game Options
    Router.route('/play/new/:gametype', function () {
        if (!Meteor.userId())
            this.redirect('/')

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
                $target.val(GameUtils.randomName());
                $target.show();
            }
            else {
                $target.hide();
            }
        },

        'click #game-begin': function () {
            FlashMessages.clear();

            var options = { };
            options.maxslots = 0;
            options.openslots = 0;
            options.computers = 0;
            options.computerNames = [ ];

            $('#game-add-players li').each(function () {
                var slot = $(this).attr('data-slot');
                var type = $(this).find('select[name="type"]').val() || 'local';
                if (type != 'empty') {
                    options.maxslots++;

                    if (type == 'open')
                        options.openslots++;
                    else if (type == 'computer') {
                        options.computerNames.push($(this).find('input[name="name"]').val());
                        options.computers++;
                    }
                }
            });

            options.waitall = $('input[name="waitall"]').is(':checked');
            options.allowspectators = $('input[name="allowspectators"]').is(':checked');

            $('.game-extended-options input:not([type="checkbox"],[type="submit"],[type="button"]),select,textarea').each(function () {
                if ($(this).is(':visible') || $(this).is('[type="hidden"]'))
                    options[$(this).attr('name')] = $(this).val();
            });

            $('.game-extended-options input[type="checkbox"]').each(function () {
                if ($(this).is(':visible'))
                    options[$(this).attr('name')] = $(this).is(':checked') ? true : false;
            });

            if (options.maxslots < this.minslots) {
                FlashMessages.sendInfo("You must configure the minimum required players.");
            }
            else {
                console.log(options);
                Meteor.call('newGame', this.name, options, function (error, result) {
                    if (result)
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

    Template.GameFind.helpers({
        openSlots: function (game) {
            return game.options.openslots - (game.users.length - game.invites.length);
        },

        fullSlots: function (game) {
            return game.users.length + game.options.computers;
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
                        FlashMessages.sendInfo("An error occurred while attempting to join this game. " + error);
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

            this.render('GameArea', { data: { gameId: this.params.gameId } });
        },

        waitOn: function () {
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
            var game = CurrentGameData.findOne({ _id: gameId });
            if (!game)
                return { };

            var gameinfo = GameTypes.findOne({ name: game.gametype });
            game.title = gameinfo.title;
            game.template = gameinfo.template;
            game.controlsTemplate = gameinfo.controlsTemplate;
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

    Template.GameArea.events({
        'click #game-chat button': function (event, template) {
            Meteor.call('chat', this.data._id, $('#game-chat-input').val());
            $('#game-chat-input').val('');
        },

        'keydown #game-chat-input': function (event, template) {
            if (event.keyCode == 13) {
                Meteor.call('chat', this.data._id, $(event.target).val());
                $(event.target).val('');
            }
        },
    });


    Template.GameControls.events({
        'click #game-controls-quit': function () {
            // TODO ask for confirmation
            Meteor.call('quitGame', this.data._id);
            Router.go('/');
        },
    });

}


