
'use strict';

if (Meteor.isClient) {

    var tileColours = [ '#5080E0', '#B00000', '#FFB800', '#000000', '#555555' ];

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
                    //if (error)
                        $moveTarget.css('display', 'inline-block');
                    $moveTarget.removeClass('move');
                    $moveTarget = false;

                    if (error)
                        FlashMessages.sendInfo(error.reason ? error.reason : error.error);
                });

            }
        },

        'click #draw': function (event, template) {
            if (!template.data.view.yourTurn)
                return;
            Meteor.call('action', template.data._id, 'draw', 54);
        },

        'click #sort': function (event, template) {
            Meteor.call('action', template.data._id, 'sort');
        },

        'click #endturn': function (event, template) {
            Meteor.call('action', template.data._id, 'endturn', function (error, result) {
                if (error)
                    FlashMessages.sendInfo(error.reason ? error.reason : error.error);
            });
        },

        'click #reset': function (event, template) {
            Meteor.call('action', template.data._id, 'reset');
        },

        'click #ready': function (event, template) {
            Meteor.call('action', template.data._id, 'ready');
        },

        'change .player-tiles-rack-mode': function (event, template) {
            if ($(event.target).is(':checked'))
                $(event.target).parent().css('position', 'relative');
            else
                $(event.target).parent().css('position', 'fixed');
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
                if (state.turn == num) {
                    //this.actions.$nextturn.apply(this);
                    state.phase = 'next-turn';
                    Machine.applyRuns(this);
                }
                state.players.splice(num, 1);
                GameLib.updateState(this._id, state);
            }
            return true;
        },

        start: function (userId) {
            console.log('starting tilerummy');

            this.state.phase = 'round-start';
            Machine.applyRuns(this);

            this._checkComputersTurn('', 100);
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
                roundover: state.phase == 'round-over' || state.phase == 'wait-ready',
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

        _getPlayerNum: function (userId) {
            for (var i in this.state.players) {
                if (this.state.players[i].userId == userId)
                    return i;
            }
            return null;
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
                firstDown: false,
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

            state.melds = [ ];
            state.message = '';
        },


        _hasRequiredFirstDown: function () {
            var sum = 0;
            for (var i = this.state.meldsBackup.length; i < this.state.melds.length; i++) {
                for (var j in this.state.melds[i]) {
                    var rank = CardUtils.rank(this.state.melds[i][j]);
                    sum += ( CardUtils.isJoker(rank) ? 0 : rank );
                }
            }

            var required = parseInt(this.options.requiredFirstDown);
            if (!required) required = 25;
            return (sum >= required) ? true : false;
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
        '$startround': function () {
            var state = this.state;

            GameLib.log(this._id, "starting new round");
            this._initRound();

            state.deck = CardUtils.makeDeck({ sets: 2, jokers: 2 });
            var toDeal = 14;
            for (var i = 0; i < toDeal; i++) {
                for (var j in state.players)
                    state.players[j].cards.push(state.deck.shift());
            }

            state.first = (++state.first < state.players.length) ? state.first : 0;
            state.turn = state.first;
            GameLib.log(this._id, state.players[state.turn].name + " goes first");

            state.meldsBackup = state.melds;
            state.handBackup = state.players[state.turn].cards;
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
                throw new Meteor.Error('tilerummy-not-your-tile', "You cannot put that tile on your rack");
            if (destnum == -2)
                destnum = state.melds.push([]) - 1;
            if (!player.firstDown && destnum >= 0 && destnum < state.meldsBackup.length && !this._hasRequiredFirstDown())
                throw new Meteor.Error('tilerummy-first-down', "You must first make your own melds totaling " + this.options.requiredFirstDown + " point");

            var dest = destnum >= 0 ? state.melds[destnum] : player.cards;

            source.splice(tilenum, 1);
            if (source.length <= 0 && sourcenum >= 0)
                state.melds.splice(sourcenum, 1);

            dest.push(tile);
            CardUtils.sortByRankAndSuit(dest);

            if (player.cards.length >= state.handBackup.length)
                player.hasPlayed = false;
            else
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

        'sort': function (userId, action, args) {
            var player = this.state.players[this._getPlayerNum(userId)];
            CardUtils.sortByRankAndSuit(player.cards)
            return true;
	},

        'endturn': function (userId, action, args) {
            var player = this.state.players[this.state.turn];
            if (player.hasPlayed !== true)
                throw new Meteor.Error('tilerummy-must-draw-or-play', "You must either play a tile or pick up a tile");

            for (var i in this.state.melds) {
                if (!_isMeldOfKind(this.state.melds[i]) && !_isMeldOfRun(this.state.melds[i]))
                    throw new Meteor.Error('tilerummy-invalid-melds-left', "You must fix any invalid melds before you can end your turn");
            }

            if (!player.firstDown) {
                if (!this._hasRequiredFirstDown())
                    throw new Meteor.Error('tilerummy-first-down', "You must first make your own melds totaling " + this.options.requiredFirstDown + " point");
                player.firstDown = true;
            }

            this.state.melds.sort(function(a, b) { return a[0] - b[0]; });
            return true;
        },

        '$nextturn': function () {
            var state = this.state;
            if (state.players[state.turn].cards.length <= 0 || state.deck.length <= 0)
                return;

            for (var i = state.turn + 1; ; i++) {
                if (i >= state.players.length)
                    i = 0;
                if (i == state.turn)
                    break;
                if (state.players[i].cards != false) {
                    state.players[state.turn].hasPlayed = false;
                    state.turn = i;
                    //state.phase = 'meld';
                    state.meldsBackup = state.melds;
                    state.handBackup = state.players[state.turn].cards;
                    console.log('handbackup', state.handBackup);
                    return true;
                }
            }

            console.log("everyone's out, next round?");
            return;
        },

        '$endround': function () {
            var state = this.state;

            GameLib.log(this._id, "round ended");

            for (var i in state.players) {
                var total = state.players[i].cards.reduce(function (previous, current, index) {
                    var rank = CardUtils.rank(current);
                    return previous + ( CardUtils.isJoker(rank) ? 30 : rank );
                }, 0);

                if (total <= 0)
                    state.message = state.players[i].name + " won this round";
                state.players[i].score -= total;
            }

            if (!state.message)
                state.message = "Nobody wins this round.";
            GameLib.log(this._id, state.message);
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
        run: Game.actions.$startround,
        success: function (result, argslist) {
            this.state.phase = 'meld';
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
            if (argslist[1] == 'draw' || argslist[1] == 'endturn')
                this.state.phase = 'next-turn';
        },
    });

    Machine.addRule({
        condition: { phase: 'next-turn' },
        run: Game.actions.$nextturn,
        success: function (result, argslist) {
            if (result === true)
                this.state.phase = 'meld';
            else {
                this.state.phase = 'round-over';
                console.log('round over here');
            }
        },
    });

    Machine.addRule({
        condition: { phase: 'round-over' },
        run: Game.actions.$endround,
        success: function (result, argslist) {
            this.state.phase = 'wait-ready';
        },
    });

    Machine.addRule({
        condition: { phase: 'wait-ready' },
        actions: { 'ready': function (userId, action, args) {
                var player = this.state.players[this._getPlayerNum(userId)];
                player.cards = [ ];
            },
        },
        success: function (result, argslist) {
            if (this.state.players.every(function (value) { return value.type == 'computer' || value.cards; }))
                this.state.phase = 'round-start';
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
        if (meld[i] != CardUtils.Joker && (suit == suit2 || rank != rank2))
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
        if (suit != suit2 || rank + 1 != rank2) {
            if (meld[i] == CardUtils.Joker)
                continue;
            else if (rank + 2 == rank2 && meld[meld.length - 1] == CardUtils.Joker) {
                meld.splice(i, 0, meld.splice(meld.length - 1)[0]);
                i++;
            }
            else
                return false;
        }
        rank = rank2;
    }
    return true;
};

