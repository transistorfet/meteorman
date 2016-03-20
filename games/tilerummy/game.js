
'use strict';

if (Meteor.isClient) {

    var tileColours = [ '#5080E0', '#B00000', '#FFB800', '#000000' ];

    var $moveTarget = false;

    Template.Games_TileRummy.events({

        'mousedown .tile, touchstart .tile': function (event, template) {
            event.preventDefault();
            $(event.target).addClass('move');
            $moveTarget = $(event.target);
        },

        'mousemove, touchmove': function (event, template) {
            if ($moveTarget) {
                event.preventDefault();
                var touch = event.originalEvent.touches ? event.originalEvent.touches[0] : event;
                $moveTarget.offset({
                    left: touch.pageX - ($moveTarget.width() / 2),
                    top: touch.pageY - ($moveTarget.height() / 2)
                });
            }
        },

        'mouseup, touchend': function (event, template) {
            if ($moveTarget) {
                event.preventDefault();
                $moveTarget.css('display', 'none');

                var $sourceTarget = $moveTarget.closest('.tiles-meld,.tiles-hand.your-hand');
                var et = event.type == 'touchend' ? event.originalEvent.changedTouches[0] : event;
                var $destTarget = $(document.elementFromPoint(et.clientX, et.clientY)).closest('.tiles-meld,.tiles-hand.your-hand');
                console.log(event, $sourceTarget, $moveTarget, $destTarget, et.clientX, et.clientY, $(document.elementFromPoint(et.clientX, et.clientY)));
                Meteor.call('action', template.data._id, 'move', [ $sourceTarget.attr('data-meld'), $moveTarget.attr('data-tile'), $destTarget.attr('data-meld') ], function (error, result) {
                    if (error)
                        $moveTarget.css('display', 'inline-block');
                    $moveTarget.removeClass('move');
                    $moveTarget = false;
                });

            }
        },

        'click #draw': function (event, template) {
            if (!template.data.view.yourTurn)
                return;
            Meteor.call('action', template.data._id, 'draw', 54);
        },

        'click #discard-pile .tile': function (event, template) {
            if (!template.data.view.yourTurn)
                return;

            var tile = $(event.target).attr('data-tile');
            console.log('discard-pile', tile);
            if (!tile)
                return;

            Meteor.call('action', template.data._id, 'draw', tile);
        },

        'click .tiles-hand .tile': function (event, template) {
            if (!template.data.view.yourTurn)
                return;

            var $target = $(event.target);

            if (template.data.view.discard_phase) {
                var tile = $target.attr('data-tile');
                console.log('discard-phase', tile);
                if (tile)
                    Meteor.call('action', template.data._id, 'discard', tile);
                return;
            }

            else if (Session.get('tilerummy_organize')) {
                if (!$target.closest('.player-tiles').hasClass('game-turn'))
                    return;

                console.log('things', window.tilerummy_selected, event);
                if (!window.tilerummy_selected || window.tilerummy_selected == event.target) {
                    if (!$target.hasClass('selected')) {
                        window.tilerummy_selected = event.target;
                        $target.addClass('selected');
                    }
                    else {
                        window.tilerummy_selected = null;
                        $target.removeClass('selected');
                    }
                }
                else {
                    console.log('things2', event, event.offsetX > $target.width() / 2);
                    $(window.tilerummy_selected).detach();
                    if (event.offsetX > $target.width() / 2) {
                        $target.after(window.tilerummy_selected);
                        $target.after(' ');
                    }
                    else {
                        $target.before(window.tilerummy_selected);
                        $target.before(' ');
                    }

                    $(window.tilerummy_selected).removeClass('selected');
                    window.tilerummy_selected = null;
                }
            }

            else if (Session.get('tilerummy_meld') || Session.get('tilerummy_layoff')) {
                if (!$target.closest('.player-tiles').hasClass('game-turn'))
                    return;

                if (!$target.hasClass('selected')) {
                    window.tilerummy_selected = event.target;
                    $target.addClass('selected');
                }
                else {
                    window.tilerummy_selected = null;
                    $target.removeClass('selected');
                }
            }
        },

        'click .tiles-meld': function (event, template) {
            if (!template.data.view.yourTurn)
                return;

            if (Session.get('tilerummy_meld')) {
                var $target = $(event.target).closest('.tiles-meld');
                var meld = parseInt($target.attr('data-meld'));
                console.log('undomeld', meld);
                Meteor.call('action', template.data._id, 'undo-meld', meld);
                Session.set('tilerummy_meld', false);
            }
        },

        'click #meld': function (event, template) {
            Session.set('tilerummy_meld', true);
        },

        'click #layoff': function (event, template) {
            Session.set('tilerummy_layoff', true);
        },

        'click #done': function (event, template) {
            if (Session.get('tilerummy_organize')) {
                var tiles = [ ];
                $('.player-tiles.game-turn .tiles-hand .tile').each(function () {
                    tiles.push(parseInt($(this).attr('data-tile')));
                });
                Meteor.call('action', template.data._id, 'organize', tiles);
                Session.set('tilerummy_organize', false);
            }

            else if (Session.get('tilerummy_meld') || Session.get('tilerummy_layoff')) {
                if (Session.get('tilerummy_meld')) {
                    var action = 'meld';
                    Session.set('tilerummy_meld', false);
                }
                else {
                    var action = 'layoff';
                    Session.set('tilerummy_layoff', false);
                }

                var tiles = [ ];
                $('.player-tiles.game-turn .tiles-hand .tile.selected').each(function () {
                    tiles.push(parseInt($(this).attr('data-tile')));
                    $(this).removeClass('selected');
                });
                Meteor.call('action', template.data._id, action, tiles, function (error, result) {
                    if (error && error.error == 'tilerummy-invalid-meld')
                        FlashMessages.sendInfo("Sorry, that isn't a valid meld");
                });
            }
        },

        'click #endturn': function (event, template) {
            Meteor.call('action', template.data._id, 'endturn');
        },

        'click #discard': function (event, template) {
            var tile = $(event.target).attr('data-tile');
            console.log('discard-phase', tile);
            if (tile)
                Meteor.call('action', template.data._id, 'discard', tile);
        },

        'click #organize': function (event, template) {
            Session.set('tilerummy_organize', true);
        },

        'click #sort': function (event, template) {
            Meteor.call('action', template.data._id, 'sort');
        },

        'click #reset': function (event, template) {
            Meteor.call('action', template.data._id, 'reset');
        },

        'click #ready': function (event, template) {
            Meteor.call('action', template.data._id, 'ready');
        },
    });

    Template.Games_TileRummy.helpers({
        isYourHand: function (hand) {
            return (hand.userId == Meteor.userId());
        },

        getHands: function () {
            var userId = Meteor.userId();
            var hands = this.view.hands;
            for (var i = 0; i < hands.length; i++) {
                if (hands[hands.length - 1].userId == userId)
                    break;
                hands.unshift(hands.pop());
            }
            return hands;
        },

        inSelectMode: function () {
            return Session.get('tilerummy_organize') || Session.get('tilerummy_meld') || Session.get('tilerummy_layoff');
        },

        tileStyle: function (tile) {
            var colour = Math.floor((tile - 1) / 13);
            return 'color: ' + tileColours[colour] + ';';
        },

        tileRank: function (tile) {
            if (tile == 53)
                return 'X';
            else if (tile == 54)
                return ' ';
            else
                return ((tile - 1) % 13) + 1;
        },

        isValidMeld: function (meld) {
            return _isMeldOfKind(meld) || _isMeldOfRun(meld);
        }
    });
}

if (Meteor.isServer) {

    Meteor.startup(function () {
        GameLib.Types.add({
            name: 'tilerummy',
            title: 'TileRummy',
            template: 'Games_TileRummy',
            configTemplate: 'Games_TileRummy_Configure',
            controlsTemplate: 'Games_TileRummy_Controls',
            methods: Game,
            minslots: 2,
            maxslots: 4,
            allowjoins: true,
        });
    });

    var Game = {
        init: function (userId) {
            console.log('init tilerummy');
            var state = this.state;

            this._initGame();

            for (var i in this.users)
                this._addPlayer('person', userId, Accounts.getUsername(this.users[i]));

            for (var i = 0; i < this.options.computers; i++)
                this._addPlayer('computer', '', i < this.options.computerNames.length ? this.options.computerNames[i] : GameUtils.randomName());

            GameUtils.shuffle(state.players);
            GameLib.updateState(this._id, state);
        },

        playerJoin: function (userId) {
            var state = this.state;

            var num = this._addPlayer('person', userId, Accounts.getUsername(userId));
            GameLib.log(this._id, state.players[num].name + " joined the game.");

            GameLib.updateState(this._id, state);
            return true;
        },

        playerQuit: function (userId) {
            var state = this.state;

            var num = this._getPlayerNum(userId);
            if (num) {
                GameLib.log(this._id, state.players[num].name + " quit the game.");
                if (state.turn == num)
                    this.actions.$nextturn.apply(this);
                state.players.splice(num, 1);
                GameLib.updateState(this._id, state);
            }
            return true;
        },

        start: function (userId) {
            console.log('starting tilerummy');
            this._startRound();
            GameLib.updateState(this._id, this.state);
        },

        finish: function (userId) {
            console.log('finish tilerummy');
        },

        action: function (userId, action, argslist) {
            console.log('action', this.state, userId, action, argslist);
            var state = this.state;

            if (Machine.applyAction(this, userId, action, argslist)) {
                Machine.applyRuns(this);
                GameLib.updateState(this._id, state);
            }

            this._checkComputersTurn('', 1500);
            return true;
        },

        getPlayerView: function (userId) {
            var state = this.state;

            var view = {
                meld_phase: state.phase == 'meld',
                roundover: state.phase == 'round-over',
                turn: state.turn,
                yourTurn: state.players[state.turn].userId == userId,
                hands: [ ],
                melds: state.melds,
                message: state.message,
            };

            for (var i in state.players) {
                var player = state.players[i];
                if (player.userId == userId || state.phase == 'round-over')
                    var cards = player.cards != false ? player.cards : [ ];
                else
                    var cards = player.cards != false ? Array(player.cards.length).fill(CardUtils.backOfCard()) : [ ];

                view.hands.push({
                    userId: player.userId,
                    name: player.name,
                    score: player.score,
                    message: player.message,
                    hasPlayed: player.hasPlayed,
                    isHandsTurn: (state.phase != 'round-over' && state.turn == i),
                    cards: cards,
                });
            }

            return view;
        },


        _initGame: function () {
            var state = this.state;

            state.first = 0;
            state.players = [ ];
        },

        _addPlayer: function (type, userId, name) {
            this.state.players.push({
                type: type,
                userId: userId,
                name: name,
                score: 0,
                cards: [ ],
                message: '',
            });
            return this.state.players.length - 1;
        },

        _initRound: function () {
            var state = this.state;
            var players = state.players;

            for (var j in players) {
                players[j].cards = [ ];
                players[j].hasPlayed = false;
                players[j].message = '';
            }

            /*
            state.deck = CardUtils.makeDeck({});

            // deal cards to players
            var toDeal = (players.length <= 2) ? 10 : 7;
            for (var i = 0; i < toDeal; i++) {
                for (var j in players)
                    state.players[j].cards.push(state.deck.shift());
            }
            */

            //state.phase = 'draw';
            state.melds = [ ];
            state.message = '';
            //state.first = this._nextPlayer(state.first);
            //state.turn = state.first;

            //state.meldsBackup = state.melds;
            //state.handBackup = state.players[state.turn].cards;
        },

        _startRound: function () {
            GameLib.log(this._id, "starting new round");

            this._initRound();

            this.state.phase = 'round-start';
            Machine.applyRuns(this);

            this._checkComputersTurn('', 100);
        },

        _endRound: function () {
            var state = this.state;
            state.phase = 'round-over';

            GameLib.log(this._id, "round ended");

            for (var i in state.players) {
                var total = state.players[i].cards.reduce(function (previous, current, index) {
                    var rank = CardUtils.rank(current);
                    return previous + rank;
                }, 0);

                if (total <= 0)
                    state.message = state.players[i].name + " won this round";
                state.players[i].score += total;
            }

            if (!state.message)
                state.message = "Nobody wins this round.";
        },



        _nextPlayer: function (current) {
            current += 1;
            return (current < this.state.players.length) ? current : 0;
        },

        _getPlayerNum: function (userId) {
            for (var i in this.state.players) {
                if (this.state.players[i].userId == userId)
                    return i;
            }
            return null;
        },



        _checkComputersTurn: function (userId, delay) {
            var self = this;

            delay = delay ? delay : 100;
            if (this.state.players[this.state.turn].type == 'computer') {
                Meteor.setTimeout(function () {
                    // in case something changed during the time delay, check who's turn it is again
                    if (self.state.players[self.state.turn].type != 'computer')
                        return;
                    if (self.bot.doTurn(self, '') !== false)
                        GameLib.updateState(self._id, self.state);
                }, delay);
                //Meteor.wrapAsync(this._computersTurn, this);
            }
        },

    };

    Game.bot = {
        doTurn: function (gameobj, userId) {
            var state = gameobj.state;
            console.log('computers turn', state.players[state.turn]);

            try {
                /*
                if (state.phase.indexOf('betting') >= 0)
                    gameobj.action(userId, 'call');
                else if (state.phase == 'trading')
                    gameobj.action(userId, 'trade', [ ]);
                else
                    gameobj._nextTurn();
                    //this.action(self, userId, 'ready');
                */
                gameobj.actions.$nextturn.apply(gameobj);
            }
            catch (error) {
                console.log("error during computer's turn", error);
                gameobj.action(userId, 'fold');
            }
            return true;
        },
    };


    Game.actions = {
        '$deal': function () {
            var state = this.state;

            state.deck = CardUtils.makeDeck({ sets: 2, jokers: 2 });
            var toDeal = 14;
            for (var i = 0; i < toDeal; i++) {
                for (var j in state.players)
                    state.players[j].cards.push(state.deck.shift());
            }
        },

        'draw': function (userId, action, args) {
            var state = this.state;
            var player = state.players[state.turn];

            if (player.hasPlayed === true)
                throw new Meteor.Error('tilerummy-already-played');

            var i = Math.floor(Math.random() * state.deck.length);
            GameLib.log(this._id, player.name + " draws a from the pile");
            var cards = state.deck.splice(i, 1);
            player.cards.push(cards[0]);
            //CardUtils.sortByRankAndSuit(player.cards);
            return true;
        },

        'meld': function (userId, action, args) {
            var state = this.state;
            var player = state.players[state.turn];

            if (!_isMeldOfKind(args, player) && !_isMeldOfRun(args, player))
                throw new Meteor.Error('tilerummy-invalid-meld');

            for (var i in args) {
                var index = player.cards.indexOf(args[i]);
                if (index >= 0)
                    player.cards.splice(index, 1);
            }

            state.melds.push(args);
            player.hasPlayed = true;
            return true;
        },

        'layoff': function (userId, action, args) {
            var state = this.state;
            var player = state.players[state.turn];

            if (!_isMeldOfKind(args, player) && !_isMeldOfRun(args, player))
                throw new Meteor.Error('tilerummy-invalid-meld');

            for (var i in args) {
                var index = player.cards.indexOf(args[i]);
                if (index >= 0)
                    player.cards.splice(index, 1);
            }

            state.melds.push(args);
            player.hasPlayed = true;
            return true;
        },

        'move': function (userId, action, args) {
            var state = this.state;
            var player = state.players[state.turn];
            var sourcenum = args[0] ? parseInt(args[0]) : null;
            var tile = parseInt(args[1]);
            var destnum = args[2] ? parseInt(args[2]) : null;

            if (sourcenum === null || sourcenum < -1 || sourcenum > state.melds.length)
                throw new Meteor.Error('tilerummy-invalid-source');
            var source = sourcenum >= 0 ? state.melds[sourcenum] : player.cards;

            var tilenum = source.indexOf(tile);
            if (tilenum <= -1)
                throw new Meteor.Error('tilerummy-invalid-tile');

            if (destnum === null || destnum < -2 || destnum > state.melds.length || sourcenum == destnum)
                throw new Meteor.Error('tilerummy-invalid-dest');
            if (destnum == -1 && state.handBackup.indexOf(tile) < 0)
                throw new Meteor.Error('tilerummy-not-your-tile');
            if (destnum == -2)
                destnum = state.melds.push([]) - 1;
            var dest = destnum >= 0 ? state.melds[destnum] : player.cards;

            source.splice(tilenum, 1);
            if (source.length <= 0 && sourcenum >= 0)
                state.melds.splice(sourcenum, 1);

            //var meld = dest.concat([ tile ]);
            dest.push(tile);
            CardUtils.sortByRankAndSuit(dest);
            //if (!_isMeldOfKind(meld) && !_isMeldOfRun(meld))
            //    throw new Meteor.Error('tilerummy-invalid-meld');


            player.hasPlayed = true;
            console.log('done', state.melds, player.cards);
            return true;
        },

        'reset': function (userId, action, args) {
            if (this.state.meldsBackup)
                this.state.melds = this.state.meldsBackup;
            if (this.state.handBackup)
                this.state.players[this.state.turn].cards = this.state.handBackup;
            this.state.players[this.state.turn].hasPlayed = false;
            return true;
        },

        'organize': function (userId, action, args) {
            var state = this.state;
            var player = state.players[state.turn];

            var newhand = [ ];
            for (var i in args) {
                var card = parseInt(args[i]);
                var index = player.cards.indexOf(card);
                if (index >= 0) {
                    player.cards.splice(index, 1);
                    newhand.push(card);
                }
            }
            for (var i in player.cards)
                newhand.push(player.cards[i]);

            console.log('newhand', newhand);
            player.cards = newhand;
            //this._nextPhase();
            return true;
        },

        'sort': function (userId, action, args) {
            var player = this.state.players[this.state.turn];
            CardUtils.sortByRankAndSuit(player.cards)
            return true;
	},

        'endturn': function (userId, action, args) {
            var player = this.state.players[this.state.turn];
            if (player.hasPlayed !== true)
                throw new Meteor.Error('tilerummy-must-draw-or-play');
            for (var i in this.state.melds) {
                if (!_isMeldOfKind(this.state.melds[i]) && !_isMeldOfRun(this.state.melds[i]))
                    throw new Meteor.Error('tilerummy-invalid-melds-left');
            }
            return true;
        },

        '$nextturn': function () {
            var state = this.state;
            if (state.players[state.turn].cards.length <= 0 || state.deck.length <= 0)
                this._endRound();

            for (var i = state.turn + 1; ; i++) {
                if (i >= state.players.length)
                    i = 0;
                if (i == state.turn)
                    break;
                if (state.players[i].cards != false) {
                    state.players[state.turn].hasPlayed = false;
                    state.turn = i;
                    state.phase = 'meld';
                    state.meldsBackup = state.melds;
                    state.handBackup = state.players[state.turn].cards;
                    console.log('handbackup', state.handBackup);
                    return;
                }
            }

            console.log("everyone's out, next round?");
            this._endRound();
        },
    }


    var Machine = new StateMachine();

    Machine.addHelper('isPlayersTurn', function (userId, action, args) {
        if (this.state.players[this.state.turn].userId == userId)
            return true;
        return false;
    });

    Machine.addRule({
        condition: { phase: 'round-start' },
        run: Game.actions.$deal,
        success: function (result, argslist) {
            var state = this.state;

            state.phase = 'meld';
            state.first = this._nextPlayer(state.first);
            state.turn = state.first;
            GameLib.log(this._id, state.players[state.turn].name + " goes first");

            state.meldsBackup = state.melds;
            state.handBackup = state.players[state.turn].cards;
        },
    });

    Machine.addRule({
        condition: { },
        actions: { 'organize': Game.actions.organize },
    });

    Machine.addRule({
        condition: { },
        actions: { 'sort': Game.actions.sort },
    });

    Machine.addRule({
        condition: { phase: 'meld', $isPlayersTurn: true },
        actions: {
            'draw': Game.actions.draw,
            'meld': Game.actions.meld,
            'move': Game.actions.move,
            'reset': Game.actions.reset,
            'endturn': Game.actions.endturn,
        },
        success: function (result, argslist) {
            if (argslist[1] == 'draw' || argslist[1] == 'endturn') {
                this.state.phase = 'next-turn';
    /*
                var state = this.state;
                var player = state.players[state.turn];

                if (player.cards.length <= 0 || state.deck.length <= 0)
                    this._endRound();
                else {
                    this._nextTurn();
                }
    */
            }
        },
    });

    Machine.addRule({
        condition: { phase: 'next-turn' },
        run: Game.actions.$nextturn,
        success: function () {
            this.state.phase = 'meld';
        },
    });

    Machine.addRule({
        condition: { phase: 'round-over' },
        actions: { 'ready': function (userId, action, args) {
                var player = this.state.players[this._getPlayerNum(userId)];
                player.cards = [ ];
            },
        },
        success: function (result, argslist) {
            if (this.state.players.every(function (value) { return value.type == 'computer' || value.cards; }))
                this._startRound();
        },
    });

}


var _isMeldOfKind = function (meld, player) {
    if (meld.length < 3)
        return false;

    meld.sort(function(a, b) { return a - b; });
    var [ rank, suit ] = CardUtils.rankAndSuit(meld[0]);
    for (var i = 1; i < meld.length; i++) {
        if (player && player.cards.indexOf(meld[i]) < 0)
            return false;

        var [ rank2, suit2 ] = CardUtils.rankAndSuit(meld[i]);
        if (suit == suit2 || rank != rank2)
            return false;
    }
    return true;
};

var _isMeldOfRun = function (meld, player) {
    if (meld.length < 3)
        return false;

    meld.sort(function(a, b) { return a - b; });
    var [ rank, suit ] = CardUtils.rankAndSuit(meld[0]);
    for (var i = 1; i < meld.length; i++) {
        if (player && player.cards.indexOf(meld[i]) < 0)
            return false;

        var [ rank2, suit2 ] = CardUtils.rankAndSuit(meld[i]);
        if (suit != suit2 || rank + 1 != rank2)
            return false;
        rank = rank2;
    }
    return true;
};

