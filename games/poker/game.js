
'use strict';

if (Meteor.isClient) {

    //Template.Games_Poker.onCreated(function () {
    //    GraphicsLib.load('cardset');
    //});

    Template.Games_Poker.events({

        'click #raise': function (event, template) {
            Meteor.call('action', template.data._id, 'raise', $('#raise-amount').val());
        },
        'click #call': function (event, template) {
            Meteor.call('action', template.data._id, 'call');
        },
        'click #fold': function (event, template) {
            Meteor.call('action', template.data._id, 'fold');
        },

        'click #trade': function (event, template) {
            var cards = [ ];
            $('.player-cards .card.selected').each(function () {
                cards.push($(this).attr('data-card'));
            });
            var result = Meteor.call('action', template.data._id, 'trade', cards);
        },

        'click .card': function (event, template) {
            if (template.data.view.trading) {
                var $target = $(event.target);
                if ($target.closest('.player-cards').hasClass('game-turn')) {
                    if (!$target.hasClass('selected'))
                        $target.addClass('selected');
                    else
                        $target.removeClass('selected');
                }
            }
        },

        'click #ready': function (event, template) {
            Meteor.call('action', template.data._id, 'ready');
        },
    });

    Template.Games_Poker.helpers({
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
    });
}

if (Meteor.isServer) {

    Meteor.startup(function () {
        GameLib.Types.add({
            name: 'poker',
            title: 'Poker',
            template: 'Games_Poker',
            configTemplate: 'Games_Poker_Configure',
            controlsTemplate: 'Games_Poker_Controls',
            methods: Game,
            minslots: 2,
            maxslots: 6,
            allowjoins: true,
        });
    });

    var Game = {
        init: function (userId) {
            console.log('init poker');
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
            console.log('starting poker');
            //this._startRound();
            this.$startRound();
            GameLib.updateState(this._id, this.state);
        },

        finish: function (userId) {
            console.log('finish poker');
        },

        action: function (userId, action, args) {
            console.log('action', this.state, userId, action, args);
            var self = this;
            var state = this.state;

            //if (this._doAction(userId, action, args))
            //    GameLib.updateState(this._id, state);

            if (Machines[this.options.pokerVariant].applyAction(this, userId, action, args)) {
                var result = Machines[this.options.pokerVariant].applyRuns(this);
                console.log('run result', result);
                GameLib.updateState(this._id, state);
            }

            this._checkComputersTurn('', 1500);
            return true;
        },

        getPlayerView: function (userId) {
            var state = this.state;

            var view = {
                betting: state.phase.indexOf('betting') >= 0,
                trading: state.phase == 'trading',
                roundover: state.phase == 'round-end',
                turn: state.turn,
                call: state.call - state.players[state.turn].portion,
                pot: state.pot,
                yourTurn: state.players[state.turn].userId == userId,
                hands: [ ],
                table: state.table != false ? state.table : null,
                message: state.message,
            };

            for (var i in state.players) {
                var player = state.players[i];
                if (player.userId == userId || state.phase == 'round-end') {
                    player.message = player.cards != false ? Game._scoreName(Game._calculateScore(player.cards)) : '';
                    var cards = player.cards != false ? player.cards : [ ];
                }
                else
                    var cards = player.cards != false ? Array(player.cards.length).fill(CardUtils.backOfCard()) : [ ];

                view.hands.push({
                    userId: player.userId,
                    name: player.name,
                    chips: player.chips,
                    message: player.message,
                    isHandsTurn: (state.phase != 'reveal' && state.turn == i),
                    cards: cards,
                });
            }

            return view;
        },

        _initGame: function () {
            var state = this.state;

            state.pot = 0;
            state.first = 0;
            state.players = [ ];
        },

        _addPlayer: function (type, userId, name) {
            this.state.players.push({
                type: type,
                userId: userId,
                name: name,
                chips: 100,
                portion: 0,
                cards: [ ],
                message: '',
            });
            return this.state.players.length - 1;
        },

        _initRound: function () {
            var state = this.state;

            for (var j in state.players) {
                state.players[j].portion = 0,
                state.players[j].cards = [ ];
                state.players[j].message = '';
            }

            state.call = 1;
            state.table = [ ];
            state.message = '';
            state.first = this._nextPlayer(state.first);
            state.turn = state.first;
        },

        $startRound: function () {
            GameLib.log(this._id, "starting new round");

            this._initRound();

            this.state.phase = 'round-start';
            Machines[this.options.pokerVariant].applyRuns(this);

            this._checkComputersTurn('', 100);
        },

        /*
        _doAction: function (userId, action, args) {
            var state = this.state;
            var player = state.players[state.turn];

            // return if it's not your turn yet
            if (player.userId != userId && state.phase != 'reveal')
                return false;

            // TODO i don't think this is supposed to happen, that it's your turn and you've folded...
            if (player.cards == false && state.phase != 'reveal')
                this._nextTurn();
            else {
                if (state.phase.indexOf('betting') >= 0) {
                    if (action == 'raise') {
                        var raise = parseInt(args);
                        if(player.chips < state.call + raise - player.portion)
                            throw new Meteor.Error('poker-not-enough-chips');

                        GameLib.log(this._id, player.name + " raised by ¤" + raise);
                        state.call += raise;
                        var diff = state.call - player.portion;
                        player.portion = state.call;
                        state.pot += diff;
                        player.chips -= diff;
                    }
                    else if (action == 'call') {
                        var diff = state.call - player.portion;
                        if (player.chips < diff)
                            throw new Meteor.Error('poker-not-enough-chips');

                        GameLib.log(this._id, player.name + " called for ¤" + state.call);
                        player.portion = state.call;
                        state.pot += diff;
                        player.chips -= diff;
                    }
                    else if (action == 'fold') {
                        GameLib.log(this._id, player.name + " folds");
                        player.cards = [ ];
                    }
                    else
                        return false;

                    this._nextTurn();
                }
                else if (state.phase == 'trading') {
                    if (action == 'trade') {
                        GameLib.log(this._id, player.name + " trades in " + ( args.length ? args.length + " cards" : "no cards" ) );
                        this._tradeCards(state.turn, args);
                        this._nextTurn();
                    }
                    else
                        return false;
                }
                else if (state.phase == 'reveal') {
                    if (action == 'ready') {
                        var player = state.players[this._getPlayerNum(userId)];
                        player.cards = [ ];
                        if (state.players.every(function (value) { return value.type == 'computer' || value.cards; }))
                            this._startRound();
                    }
                    else
                        return false;
                }
            }
            return true;
        },
        */

        /*
        _startRound: function () {
            var state = this.state;
            GameLib.log(this._id, "starting new round");

            this._initRound();

            //state.deck = Array(52).fill().map(function (current, index, array) { return index + 1; });
            //GameUtils.shuffle(state.deck);
            state.deck = CardUtils.makeDeck({});

            for (var i = 0; i < 5; i++) {
                for (var j in players)
                    this._dealCard(j);
                //players[j].cards.sort(function(a, b) { return (((b - 1) % 13) + 1) - (((a - 1) % 13) + 1); });
            }

            state.phase = 'betting1';
            state.first = this._nextPlayer(state.first);
            state.turn = state.first;

            GameLib.log(this._id, state.players[state.turn].name + " goes first");

            this._checkComputersTurn('', 100);
        },
        */


        /*
        _endRound: function () {
            var state = this.state;
            state.phase = 'reveal';

            var score, highest, winner;
            for (var i in state.players) {
                if (state.players[i].cards != false) {
                    score = this._calculateScore(state.players[i].cards);
                    state.players[i].message = this._scoreName(score);

                    if (!highest || score[0] > highest[0] || (score[0] == highest[0] && score[1] > highest[1])) {
                        highest = score;
                        winner = i;
                    }
                    else if (score[0] == highest[0] && score[1] == highest[1])
                        winner = -1;
                }
            }

            if (winner == -1)
                state.message = "It's a tie.  Nobody wins this round";
            else {
                state.message = state.players[winner].name + " won ¤" + state.pot + " with " + state.players[winner].message;
                state.players[winner].chips += state.pot;
                state.pot = 0;
            }

            GameLib.log(this._id, state.message);
            GameLib.log(this._id, "round ended");

            for (var i in state.players) {
                if (state.players[i].chips <= 0) {
                    GameLib.log(this._id, state.players[i].name + " is out of chips.");
                    state.players.splice(i, 1);
                }
            }
        },
        */

        /*
        _nextTurn: function () {
            var state = this.state;
            for (var i = state.turn + 1; ; i++) {
                if (i >= state.players.length)
                    i = 0;
                if (i == state.turn)
                    break;
                if (i == state.first)
                    this._nextPhase();
                if (state.players[i].cards != false) {
                    state.turn = i;
                    return;
                }
            }

            console.log("everyone's out, next round?");
            this._endRound();
        },

        _nextPhase: function () {
            var state = this.state;
            if (state.phase.indexOf('betting') >= 0 && state.players.some(function (current) { return current.cards != false && current.portion != state.call; }))
                return;

            if (state.phase == 'betting1')
                state.phase = 'trading';
            else if (state.phase == 'trading') {
                state.call += 1;
                state.phase = 'betting2';
            }
            else if (state.phase == 'betting2') {
                state.phase = 'reveal';
                this._endRound();
            }
        },
        */

        _nextPlayer: function (current) {
            current += 1;
            return (current < this.state.players.length) ? current : 0;
        },

        _dealCard: function (playerNum) {
            this.state.players[playerNum].cards.push(this.state.deck.shift());
        },
                    
        _tradeCards: function (playerNum, cards) {
            var hand = this.state.players[playerNum].cards;

            for (var i in cards) {
                var index = hand.indexOf(parseInt(cards[i]));
                if (index >= 0)
                    hand.splice(index, 1);
            }

            var newCards = 5 - hand.length;
            for (var i = 0; i < newCards; i++)
                this._dealCard(playerNum);
        },

        _getPlayerNum: function (userId) {
            for (var i in this.state.players) {
                if (this.state.players[i].userId == userId)
                    return i;
            }
            return null;
        },

        _bestPokerHand: function (cards) {
            // TODO finish
                score = this._calculateScore(state.players[i].cards);
                state.players[i].message = this._scoreName(score);

                if (!highest || score[0] > highest[0] || (score[0] == highest[0] && score[1] > highest[1])) {
                    highest = score;
                    winner = i;
                }
                else if (score[0] == highest[0] && score[1] == highest[1])
                    winner = -1;
        },

        _calculateScore: function (hand) {
            var cards = [ ];
            for (var i = 0; i < hand.length; i++) {
                var [ rank, suit ] = CardUtils.rankAndSuit(hand[i]);
                cards.push([ suit, rank != 1 ? rank : 14 ]);
            }
            cards.sort(function(a, b) { return b[1] - a[1]; });

            var kinds = [ [ ], [ ], [ ], [ ] ];
            for (var i = 0; i < cards.length; i++) {
                var num = cards.reduce(function (previous, current) { return previous + ( current[1] == cards[i][1] ? 1 : 0 ); }, 0);
                if (kinds[num - 1].indexOf(cards[i][1]) < 0)
                    kinds[num - 1].push(cards[i][1]);
            }

            var flush = cards.every(function (value) { return value[0] == cards[0][0]; });
            var straight = cards.every(function (value, index, array) { return index <= 0 || array[index - 1][1] - 1 == array[index][1]; });

            console.log('score', kinds, flush, straight);

            if (straight && flush)
                return [ 9, cards[0][1] ];
            else if (kinds[3].length)
                return [ 8, kinds[3][0] ];
            else if (kinds[2].length && kinds[1].length)
                return [ 7, kinds[2][0] ];
            else if (flush)
                return [ 6, cards[0][1] ];
            else if (straight)
                return [ 5, cards[0][1] ];
            else if (kinds[2].length)
                return [ 4, kinds[2][0] ];
            else if (kinds[1].length > 1)
                return [ 3, kinds[1][0] ];
            else if (kinds[1].length)
                return [ 2, kinds[1][0] ];
            else if (kinds[0].length)
                return [ 1, kinds[0][0] ];
        },

        _scoreName: function (score) {
            switch (score[0]) {
                case 9:
                    return 'a straight flush, ' + this._cardName(score[1]) + ' high';
                case 8:
                    return 'four of a kind of ' + this._cardName(score[1], true);
                case 7:
                    return 'a full house, ' + this._cardName(score[1]) + ' high';
                case 6:
                    return 'a flush, ' + this._cardName(score[1]) + ' high';
                case 5:
                    return 'a straight, ' + this._cardName(score[1]) + ' high';
                case 4:
                    return 'three of a kind of ' + this._cardName(score[1], true);
                case 3:
                    return 'two pairs, ' + this._cardName(score[1]) + ' high';
                case 2:
                    return 'a pair of ' + this._cardName(score[1], true);
                case 1:
                    return 'high card, ' + this._cardName(score[1]);
                default:
                    return 'invalid hand type';
            }
        },

        _cardName: function (rank, plural) {
            var name = (function () {
                switch (rank) {
                    case 1:
                    case 14:
                        return 'ace';
                    case 2:
                        return 'two';
                    case 3:
                        return 'three';
                    case 4:
                        return 'four';
                    case 5:
                        return 'five';
                    case 6:
                        return 'six';
                    case 7:
                        return 'seven';
                    case 8:
                        return 'eight';
                    case 9:
                        return 'nine';
                    case 10:
                        return 'ten';
                    case 11:
                        return 'jack';
                    case 12:
                        return 'queen';
                    case 13:
                        return 'king';
                    default:
                        return 'invalid-card';
                }
            })();

            if (plural)
                name = (name == 'six') ? 'sixes' : name + 's';
            return name;
        },

        _checkComputersTurn: function (userId, delay) {
            var self = this;

            delay = delay ? delay : 100;
            if (this.state.players[this.state.turn].type == 'computer') {
                Meteor.setTimeout(function () {
                    // in case something changed during the time delay, check who's turn it is again
                    if (self.state.players[self.state.turn].type != 'computer')
                        return;
                    if (self._computersTurn('') !== false)
                        GameLib.updateState(self._id, self.state);
                }, delay);
                //Meteor.wrapAsync(this._computersTurn, this);
            }
        },

        _computersTurn: function (userId) {
            var state = this.state;
            console.log('computers turn', state.players[state.turn], state.phase);
            if (state.players[state.turn].type != 'computer')
                return;

            try {
                if (state.phase.indexOf('betting') >= 0)
                    this.action(userId, 'call');
                else if (state.phase == 'trading')
                    this.action(userId, 'trade', [ ]);
                else
                    console.log('computer: sorry i think i broke it');
                    //this._nextTurn();
                    //this.action(self, userId, 'ready');
            }
            catch (error) {
                console.log("error during computer's turn", error);
                this.action(userId, 'fold');
            }
            GameLib.updateState(this._id, state);
        },

        $nextTurn: function () {
            var state = this.state;

            //if (state.phase.indexOf('betting') >= 0 && state.players.some(function (current) { return current.cards != false && current.portion != state.call; }))
            //    return true;

            console.log('changing turns', state.turn, state.first);
            for (var i = state.turn + 1; ; i++) {
                if (i >= state.players.length)
                    i = 0;
                if (i == state.turn)
                    break;
                if (i == state.first) {
                    console.log('back to first');
                    state.turn = i;
                    return false;
                }
                if (state.players[i].cards != false) {
                    state.turn = i;
                    console.log('new players turn', state.turn);
                    return true;
                }
            }

            console.log("everyone's out, next round?");
            //this._endRound();
            this.state.phase = 'reveal';
        },


    };


    Game.actions = {
        'raise': function (userId, action, args) {
            var state = this.state;
            var player = state.players[state.turn];

            var raise = parseInt(args);
            if(player.chips < state.call + raise - player.portion)
                throw new Meteor.Error('poker-not-enough-chips');

            GameLib.log(this._id, player.name + " raised by ¤" + raise);
            state.call += raise;
            var diff = state.call - player.portion;
            player.portion = state.call;
            state.pot += diff;
            player.chips -= diff;
        },

        'call': function (userId, action, args) {
            var state = this.state;
            var player = state.players[state.turn];

            var diff = state.call - player.portion;
            if (player.chips < diff)
                throw new Meteor.Error('poker-not-enough-chips');

            GameLib.log(this._id, player.name + " called for ¤" + state.call);
            player.portion = state.call;
            state.pot += diff;
            player.chips -= diff;
        },

        'fold': function (userId, action, args) {
            var state = this.state;
            var player = state.players[state.turn];

            GameLib.log(this._id, player.name + " folds");
            player.cards = [ ];
        },

        'trade': function (userId, action, args) {
            var state = this.state;
            var player = state.players[state.turn];

            GameLib.log(this._id, player.name + " trades in " + ( args.length ? args.length + " cards" : "no cards" ) );
            this._tradeCards(state.turn, args);
        },

        Draw: {
            '$deal': function () {
                var state = this.state;

                state.deck = CardUtils.makeDeck({});
                for (var i = 0; i < 5; i++) {
                    for (var j in state.players)
                        this._dealCard(j);
                    CardUtils.sortByRankAndSuit(state.players[j].cards);
                }
            },

            '$endRound': function () {
                var state = this.state;
                state.phase = 'reveal';

                var score, highest, winner;
                for (var i in state.players) {
                    if (state.players[i].cards != false) {
                        score = this._calculateScore(state.players[i].cards);
                        state.players[i].message = this._scoreName(score);

                        if (!highest || score[0] > highest[0] || (score[0] == highest[0] && score[1] > highest[1])) {
                            highest = score;
                            winner = i;
                        }
                        else if (score[0] == highest[0] && score[1] == highest[1])
                            winner = -1;
                    }
                }

                if (winner == -1)
                    state.message = "It's a tie.  Nobody wins this round";
                else {
                    state.message = state.players[winner].name + " won ¤" + state.pot + " with " + state.players[winner].message;
                    state.players[winner].chips += state.pot;
                    state.pot = 0;
                }

                GameLib.log(this._id, state.message);
                GameLib.log(this._id, "round ended");

                for (var i in state.players) {
                    if (state.players[i].chips <= 0) {
                        GameLib.log(this._id, state.players[i].name + " is out of chips.");
                        state.players.splice(i, 1);
                    }
                }
            },
        },

        HoldEm: {
            '$deal': function () {
                var state = this.state;

                state.deck = CardUtils.makeDeck({});
                for (var i = 0; i < 2; i++) {
                    for (var j in state.players)
                        this._dealCard(j);
                    state.table.push(state.deck.shift());
                    //players[j].cards.sort(function(a, b) { return (((b - 1) % 13) + 1) - (((a - 1) % 13) + 1); });
                }
            },

            '$endRound': function () {
                var state = this.state;
                state.phase = 'reveal';

                var score, highest, winner;
                for (var i in state.players) {
                    if (state.players[i].cards != false) {
                        score = this._calculateScore(state.players[i].cards);
                        state.players[i].message = this._scoreName(score);

                        if (!highest || score[0] > highest[0] || (score[0] == highest[0] && score[1] > highest[1])) {
                            highest = score;
                            winner = i;
                        }
                        else if (score[0] == highest[0] && score[1] == highest[1])
                            winner = -1;
                    }
                }

                if (winner == -1)
                    state.message = "It's a tie.  Nobody wins this round";
                else {
                    state.message = state.players[winner].name + " won ¤" + state.pot + " with " + state.players[winner].message;
                    state.players[winner].chips += state.pot;
                    state.pot = 0;
                }

                GameLib.log(this._id, state.message);
                GameLib.log(this._id, "round ended");

                for (var i in state.players) {
                    if (state.players[i].chips <= 0) {
                        GameLib.log(this._id, state.players[i].name + " is out of chips.");
                        state.players.splice(i, 1);
                    }
                }
            },
        },
    };


    var Machines = { };

    Machines.Draw = (function () {
        var Machine = new StateMachine();

        Machine.addHelper('isPlayersTurn', function (userId, action, args) {
            if (this.state.players[this.state.turn].userId == userId)
                return true;
            return false;
        });


        Machine.addRule({
            condition: { phase: 'round-start' },
            run: Game.actions.Draw.$deal,
            success: function (result, argslist) {
                var state = this.state;

                state.phase = 'betting1';
                //state.first = this._nextPlayer(state.first);
                //state.turn = state.first;
                GameLib.log(this._id, state.players[state.turn].name + " goes first");
            },
        });

        Machine.addRule({
            condition: { phase: /^betting\d$/, $isPlayersTurn: true },
            actions: {
                'call': Game.actions.call,
                'raise': Game.actions.raise,
                'fold': Game.actions.fold,
            },
            success: function (userId, action, args) {
                var state = this.state;

                //this._nextTurn();
                if (this.$nextTurn() === false) {
                    if (state.players.some(function (current) { return current.cards != false && current.portion != state.call; }))
                        return true;

                    if (this.state.phase == 'betting1')
                        this.state.phase = 'trading';
                    else
                        this.state.phase = 'reveal';
                }
            },
        });

        Machine.addRule({
            condition: { phase: 'trading', $isPlayersTurn: true },
            actions: { 'trade': Game.actions.trade },
            success: function (userId, action, args) {
                //this._nextTurn();
                if (this.$nextTurn() === false) {
                    this.state.call += 1;
                    this.state.phase = 'betting2';
                }
            },
        });

        Machine.addRule({
            condition: { phase: 'reveal' },
            run: Game.actions.Draw.$endRound,
            success: function (result, argslist) {
                this.state.phase = 'round-end';
            },
        });

        Machine.addRule({
            condition: { phase: 'round-end' },
            actions: { 'ready': function (userId, action, args) {
                    var player = this.state.players[this._getPlayerNum(userId)];
                    player.cards = [ ];
                },
            },
            success: function () {
                if (this.state.players.every(function (value) { return value.type == 'computer' || value.cards == false; }))
                    this.$startRound();
            },
        });

        return Machine;
    })();


    Machines.HoldEm = (function () {
        var Machine = new StateMachine();

        Machine.addHelper('isPlayersTurn', function (userId, action, args) {
            if (this.state.players[this.state.turn].userId == userId)
                return true;
            return false;
        });

        /*
        Machine.addRule({
            condition: { phase: 'deal' },
            run: function () {
                // do all the dealings stuff
                Game.steps.deal();
                this.state.turn = 0;
                this.state.phase = 'draw'
            },
        });
        */

        Machine.addRule({
            condition: { phase: 'round-start' },
            run: Game.actions.HoldEm.$deal,
            success: function (result, argslist) {
                var state = this.state;

                state.phase = 'betting1';
                //state.first = this._nextPlayer(state.first);
                //state.turn = state.first;
                GameLib.log(this._id, state.players[state.turn].name + " goes first");
            },
        });

        Machine.addRule({
            condition: { phase: /^betting\d$/, $isPlayersTurn: true },
            actions: {
                'call': Game.actions.call,
                'raise': Game.actions.raise,
                'fold': Game.actions.fold,
                //'$flop': Game.actions.flop,   // then this wolud deal the card and put it into the next betting phase?  The use of the success function seems appropriate, but since this is
                                                // a different transition ($flop -> betting(n+1) instead of betting(n) -> $flop), it should have it's own rule
            },
            success: function (result, argslist) {
                var state = this.state;

                if (this.$nextTurn() === false) {
                    if (state.players.some(function (current) { return current.cards != false && current.portion != state.call; }))
                        return true;

                    if (this.state.phase == 'betting4')
                        this.state.phase = 'reveal';
                    else {
                        this.state.phase = this.state.phase.replace('betting', 'flop');
                        //Machine.applyAction(this, '', '$flop');
                        //Game.actions.$flop.apply(this)    // this method doesn't allow you to store the transition code in the success function, so the flop would do the action + transition
                    }
                }
                console.log('done betting', this.state.phase);
            },
        });

        Game.actions.$flop = function (userId, action, args) {
            this.state.table.push(this.state.deck.shift());
            console.log('flop', this.state.table);
        };

        // TODO this is an alternative to the flop, with an action action dispatch to this rule... i guess the bizzare thing is that the betting rule is directly referring to this rule, but indirectly
        Machine.addRule({
            condition: { phase: /^flop\d$/ },
            /* actions: { '$flop': Game.actions.$flop }, */
            run: Game.actions.$flop,
            success: function (result, argslist) {
                this.state.phase = 'betting' + (parseInt(this.state.phase.replace('flop', '')) + 1);
                this.state.call += 1;
                console.log('flop done', this.state.phase);
            },
        });

        Machine.addRule({
            condition: { phase: 'reveal' },
            run: Game.actions.HoldEm.$endRound,
            success: function (result, argslist) {
                this.state.phase = 'round-end';
            },
        });

        Machine.addRule({
            condition: { phase: 'round-end' },
            actions: {
                'ready': function (userId, action, args) {
                    var player = this.state.players[this._getPlayerNum(userId)];
                    player.cards = [ ];
                },
            },
            success: function (result, argslist) {
                if (this.state.players.every(function (value) { return value.type == 'computer' || value.cards == false; }))
                    this.$startRound();
                    //this.state.phase = 'deal';  // TODO and then it would try applying rules again, and hit the 'deal' rule which deals the cards and starts the game
                    // an alternative would be to asyncronously dispatch the 'deal' action??
                    //Machine.applyAction(this, '', '$start');
                    //Game.actions.$start.apply(this);
            },
        });

        return Machine;
    })();

}


