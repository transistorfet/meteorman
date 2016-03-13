
'use strict';

if (Meteor.isClient) {


    Template.Games_Rummy.events({

        'click #discard-pile .card': function (event, template) {
            if (!template.data.view.yourTurn)
                return;

            var card = $(event.target).attr('data-card');
            console.log('discard-pile', card);
            if (!card)
                return;

            Meteor.call('action', template.data._id, 'draw', card);
        },

        'click .cards-hand .card': function (event, template) {
            if (!template.data.view.yourTurn)
                return;

            var $target = $(event.target);

            if (template.data.view.discard_phase) {
                var card = $target.attr('data-card');
                console.log('discard-phase', card);
                if (card)
                    Meteor.call('action', template.data._id, 'discard', card);
                return;
            }

            else if (Session.get('rummy_organize')) {
                if (!$target.closest('.player-cards').hasClass('game-turn'))
                    return;

                console.log('things', window.rummy_selected, event);
                if (!window.rummy_selected || window.rummy_selected == event.target) {
                    if (!$target.hasClass('selected')) {
                        window.rummy_selected = event.target;
                        $target.addClass('selected');
                    }
                    else {
                        window.rummy_selected = null;
                        $target.removeClass('selected');
                    }
                }
                else {
                    console.log('things2', event, event.offsetX > $target.width() / 2);
                    $(window.rummy_selected).detach();
                    if (event.offsetX > $target.width() / 2) {
                        $target.after(window.rummy_selected);
                        $target.after(' ');
                    }
                    else {
                        $target.before(window.rummy_selected);
                        $target.before(' ');
                    }

                    $(window.rummy_selected).removeClass('selected');
                    window.rummy_selected = null;
                }
            }

            else if (Session.get('rummy_meld') || Session.get('rummy_layoff')) {
                if (!$target.closest('.player-cards').hasClass('game-turn'))
                    return;

                if (!$target.hasClass('selected')) {
                    window.rummy_selected = event.target;
                    $target.addClass('selected');
                }
                else {
                    window.rummy_selected = null;
                    $target.removeClass('selected');
                }
            }
        },

        'click .cards-meld': function (event, template) {
            if (!template.data.view.yourTurn)
                return;

            if (Session.get('rummy_meld')) {
                var $target = $(event.target).closest('.cards-meld');
                var meld = parseInt($target.attr('data-meld'));
                console.log('undomeld', meld);
                Meteor.call('action', template.data._id, 'undo-meld', meld);
                Session.set('rummy_meld', false);
            }
        },

        'click #meld': function (event, template) {
            Session.set('rummy_meld', true);
        },

        'click #layoff': function (event, template) {
            Session.set('rummy_layoff', true);
        },

        'click #done': function (event, template) {
            if (Session.get('rummy_organize')) {
                var cards = [ ];
                $('.player-cards.game-turn .cards-hand .card').each(function () {
                    cards.push(parseInt($(this).attr('data-card')));
                });
                Meteor.call('action', template.data._id, 'organize', cards);
                Session.set('rummy_organize', false);
            }

            else if (Session.get('rummy_meld') || Session.get('rummy_layoff')) {
                if (Session.get('rummy_meld')) {
                    var action = 'meld';
                    Session.set('rummy_meld', false);
                }
                else {
                    var action = 'layoff';
                    Session.set('rummy_layoff', false);
                }

                var cards = [ ];
                $('.player-cards.game-turn .cards-hand .card.selected').each(function () {
                    cards.push(parseInt($(this).attr('data-card')));
                    $(this).removeClass('selected');
                });
                Meteor.call('action', template.data._id, action, cards, function (error, result) {
                    if (error && error.error == 'rummy-invalid-meld')
                        FlashMessages.sendInfo("Sorry, that isn't a valid meld");
                });
            }

            else if (template.data.view.meld_phase) {
                Meteor.call('action', template.data._id, 'done');
            }
        },

        'click #discard': function (event, template) {
            var card = $(event.target).attr('data-card');
            console.log('discard-phase', card);
            if (card)
                Meteor.call('action', template.data._id, 'discard', card);
        },

        'click #organize': function (event, template) {
            Session.set('rummy_organize', true);
        },

        'click #sort': function (event, template) {
            Meteor.call('action', template.data._id, 'sort');
        },

        'click #knock': function (event, template) {
            Meteor.call('action', template.data._id, 'knock');
        },

        'click #ready': function (event, template) {
            Meteor.call('action', template.data._id, 'ready');
        },
    });

    Template.Games_Rummy.helpers({
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
            return Session.get('rummy_organize') || Session.get('rummy_meld') || Session.get('rummy_layoff');
        },
    });
}

if (Meteor.isServer) {

    Meteor.startup(function () {
        GameLib.Types.add({
            name: 'rummy',
            title: 'Rummy',
            template: 'Games_Rummy',
            configTemplate: 'Games_Rummy_Configure',
            controlsTemplate: 'Games_Rummy_Controls',
            methods: Game,
            minslots: 2,
            maxslots: 4,
            allowjoins: true,
        });
    });

    var Game = {
        init: function (userId) {
            console.log('init rummy');
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
                    this._nextTurn();
                state.players.splice(num, 1);
                GameLib.updateState(this._id, state);
            }
            return true;
        },

        start: function (userId) {
            console.log('starting rummy');
            this._startRound();
            GameLib.updateState(this._id, this.state);
        },

        finish: function (userId) {
            console.log('finish rummy');
        },

        action: function (userId, action, args) {
            console.log('action', this.state, userId, action, args);
            var state = this.state;

            if (Machine.applyAction(this, userId, action, args))
                GameLib.updateState(this._id, state);

            this._checkComputersTurn('', 1500);
            return true;
        },

        getPlayerView: function (userId) {
            var state = this.state;

            var view = {
                draw_phase: state.phase == 'draw',
                meld_phase: state.phase == 'meld',
                discard_phase: state.phase == 'discard',
                roundover: state.phase == 'round-over',
                turn: state.turn,
                discard: state.discard[0] ? state.discard[0] : 0,
                yourTurn: state.players[state.turn].userId == userId,
                hands: [ ],
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
                    isHandsTurn: (state.phase != 'round-over' && state.turn == i),
                    cards: cards,
                    melds: player.melds,
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
                melds: [ ],
                message: '',
            });
            return this.state.players.length - 1;
        },

        _startRound: function () {
            var state = this.state;
            GameLib.log(this._id, "starting new round");

            var players = state.players;
            for (var j in players) {
                players[j].cards = [ ];
                players[j].melds = [ ];
                players[j].message = '';
            }

            state.deck = CardUtils.makeDeck({});

            // deal cards to players
            var toDeal = (players.length <= 2) ? 10 : 7;
            for (var i = 0; i < toDeal; i++) {
                for (var j in players)
                    state.players[j].cards.push(state.deck.shift());
            }

            state.discard = [ state.deck.shift() ];
            state.first = this._nextPlayer(state.first);
            state.turn = state.first;
            state.message = '';
            state.phase = 'draw';
            GameLib.log(this._id, state.players[state.turn].name + " goes first");

            this._checkComputersTurn('', 100);
        },

        _endRound: function () {
            var state = this.state;
            state.phase = 'round-over';

            GameLib.log(this._id, "round ended");

            for (var i in state.players) {
                var total = state.players[i].cards.reduce(function (previous, current, index) {
                    var rank = CardUtils.rank(current);
                    return previous + ( (rank <= 10) ? rank : 10 );
                }, 0);

                if (total <= 0)
                    state.message = state.players[i].name + " won this round";
                state.players[i].score += total;
            }

            if (!state.message)
                state.message = "Nobody wins this round.";
        },

        _nextTurn: function () {
            var state = this.state;
            for (var i = state.turn + 1; ; i++) {
                if (i >= state.players.length)
                    i = 0;
                if (i == state.turn)
                    break;
                if (state.players[i].cards != false) {
                    state.phase = 'draw';
                    state.turn = i;
                    return;
                }
            }

            console.log("everyone's out, next round?");
            this._endRound();
        },

        _nextPlayer: function (current) {
            current += 1;
            return (current < this.state.players.length) ? current : 0;
        },

        //_dealCard: function (playerNum) {
        //    this.state.players[playerNum].cards.push(this.state.deck.shift());
        //},

        _getPlayerNum: function (userId) {
            for (var i in this.state.players) {
                if (this.state.players[i].userId == userId)
                    return i;
            }
            return null;
        },

        _isMeldOfKind: function (meld, player) {
            if (meld.length < 3)
                return false;

            meld.sort(function(a, b) { return a - b; });
            var [ rank, suit ] = CardUtils.rankAndSuit(meld[0]);
            for (var i = 1; i < meld.length; i++) {
                if (player.cards.indexOf(meld[i]) < 0)
                    return false;

                var [ rank2, suit2 ] = CardUtils.rankAndSuit(meld[i]);
                if (suit == suit2 || rank != rank2)
                    return false;
            }
            return true;
        },

        _isMeldOfRun: function (meld, player) {
            if (meld.length < 3)
                return false;

            meld.sort(function(a, b) { return a - b; });
            var [ rank, suit ] = CardUtils.rankAndSuit(meld[0]);
            for (var i = 1; i < meld.length; i++) {
                if (player.cards.indexOf(meld[i]) < 0)
                    return false;

                var [ rank2, suit2 ] = CardUtils.rankAndSuit(meld[i]);
                if (suit != suit2 || rank + 1 != rank2)
                    return false;
                rank = rank2;
            }
            return true;
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
                if (state.phase.indexOf('betting') >= 0)
                    gameobj.action(userId, 'call');
                else if (state.phase == 'trading')
                    gameobj.action(userId, 'trade', [ ]);
                else
                    gameobj._nextTurn();
                    //this.action(self, userId, 'ready');
            }
            catch (error) {
                console.log("error during computer's turn", error);
                gameobj.action(userId, 'fold');
            }
            return true;
        },
    };


    Game.actions = {
        'draw': function (userId, action, args) {
            var state = this.state;
            var player = state.players[state.turn];

            args = parseInt(args);
            console.log('drawing', args, CardUtils.isNotCard(args));
            if (CardUtils.isNotCard(args)) {
                GameLib.log(this._id, player.name + " draws a card from the stock pile");
                player.cards.push(state.deck.shift());
            }
            else if (args == state.discard[0]) {
                GameLib.log(this._id, player.name + " draws a " + CardUtils.rankName(state.discard[0]) + " from the discard pile");
                player.cards.push(state.discard.shift());
            }
            else
                return false;
            return true;
        },

        'meld': function (userId, action, args) {
            var state = this.state;
            var player = state.players[state.turn];

            if (!this._isMeldOfKind(args, player) && !this._isMeldOfRun(args, player))
                throw new Meteor.Error('rummy-invalid-meld');

            for (var i in args) {
                var index = player.cards.indexOf(args[i]);
                if (index >= 0)
                    player.cards.splice(index, 1);
            }

            player.melds.push(args);
            return true;
        },

        'undo_meld': function (userId, action, args) {
            var state = this.state;
            var player = state.players[state.turn];

            if (args in player.melds) {
                var meld = player.melds.splice(args, 1);
                for (var i in meld[0])
                    player.cards.push(meld[0][i]);
            }
            console.log('doneundo', player);
            return true;
        },

        'layoff': function (userId, action, args) {
            var state = this.state;
            var player = state.players[state.turn];

            if (!this._isMeldOfKind(args, player) && !this._isMeldOfRun(args, player))
                throw new Meteor.Error('rummy-invalid-meld');

            for (var i in args) {
                var index = player.cards.indexOf(args[i]);
                if (index >= 0)
                    player.cards.splice(index, 1);
            }

            player.melds.push(args);
            return true;
        },

        'discard': function (userId, action, args) {
            var state = this.state;
            var player = state.players[state.turn];

            args = parseInt(args);
            var index = player.cards.indexOf(args);
            console.log('discard action', args, index, player);
            if (index < 0)
                return false;
            GameLib.log(this._id, player.name + " discards a " + CardUtils.rankName(args));
            player.cards.splice(index, 1);
            state.discard.unshift(args);
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
    }


    var Machine = new StateMachine();

    Machine.addHelper('isPlayersTurn', function (userId, action, args) {
        if (this.state.players[this.state.turn].userId == userId)
            return true;
        return false;
    });


    Machine.addRule({
        condition: { phase: 'deal' },
        run: function () {
            // do all the dealings stuff
            this.state.turn = 0;
            this.state.phase = 'draw'
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
        condition: { phase: 'draw', $isPlayersTurn: true },
        actions: { 'draw': Game.actions.draw },
        success: function (result, argslist) {
            this.state.phase = 'meld';
        },
    });

    Machine.addRule({
        condition: { phase: 'meld', $isPlayersTurn: true },
        actions: {
            'meld': Game.actions.meld,
            'undo-meld': Game.actions.undo_meld,
            'done': function (userId, action, args) {
                this.state.phase = 'discard';
            },
        },
        success: function (result, argslist) {
            //if (action == 'done')
            //    this.state.phase = 'discard';
        },
    });

    Machine.addRule({
        condition: { phase: 'discard', $isPlayersTurn: true },
        actions: { 'discard': Game.actions.discard },
        success: function (result, argslist) {
            var state = this.state;
            var player = state.players[state.turn];

            if (player.cards.length <= 0 || state.deck.length <= 2)
                this._endRound();
            else {
                state.phase = 'draw';
                this._nextTurn();
            }
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



