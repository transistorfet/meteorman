
'use strict';

if (Meteor.isClient) {
    var TileInfo = {
        'width': 32,
        'height': 48,
        'numx': 16,
        'numy': 4
    }

    var updateCard = function (element, tile) {
        if (tile !== undefined)
            $(element).attr('data-card', tile);

        var tile = $(element).attr('data-card');
        var x = (tile % TileInfo.numx) * TileInfo.width;
        var y = Math.floor(tile / TileInfo.numx) * TileInfo.height;
        $(element).css('background-position', '-' + x + 'px -' + y + 'px');
    }

    Template.Games_Poker.onCreated(function () {
        this.autorun(function () {
            var reactive = Template.currentData();

            Tracker.afterFlush(function () {
                $('.card').each(function () {
                    updateCard(this);
                });
            });
        });
    });

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

    var Game = Object.create({
        init: function (self, userId) {
            console.log('init poker');
            var state = self.state;

            state.pot = 0;
            state.first = 0;
            state.players = [ ];
            for (var i in self.options.slots) {
                var slot = self.options.slots[i];
                state.players[i] = {
                    userId: slot.userId,
                    name: slot.name,
                    type: slot.type,
                    chips: 100,
                    portion: 0,
                    folded: false,
                    cards: [ ],
                    message: '',
                };
            }

            Game._startRound(self);
            console.log('init state', state);
            GameLib.updateState(self._id, state);
        },

        finish: function (self, userId) {
            console.log('finish poker');
        },

        getPlayerView: function (self, userId) {
            var state = self.state;

            var view = {
                betting: state.phase.indexOf('betting') >= 0,
                trading: state.phase == 'trading',
                roundover: state.phase == 'reveal',
                turn: state.turn,
                call: state.call - state.players[state.turn].portion,
                pot: state.pot,
                yourTurn: state.players[state.turn].userId == userId,
                hands: [ ],
                message: state.message,
            };

            for (var i in state.players) {
                var player = state.players[i];
                if (player.userId == userId || state.phase == 'reveal') {
                    player.message = player.cards != false ? Game._scoreName(Game._calculateScore(player.cards)) : '';
                    var cards = player.cards;
                }
                else
                    var cards = player.cards != false ? [ 54, 54, 54, 54, 54 ] : [ ];

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

        action: function (self, userId, action, args) {
            console.log('action', self.state, userId, action, args);
            var state = self.state;

            if (Game._doAction(self, userId, action, args))
                GameLib.updateState(self._id, state);

            // check if the computer should play the next round
            if (state.players[state.turn].type == 'computer') {
                Meteor.setTimeout(function () {
                    Game._computersTurn(self, '');
                }, 1500);
                //Meteor.wrapAsync(Game._computersTurn, self);
            }

            return true;
        },

        playerQuit: function (self, userId) {
            var state = self.state;
            var players = state.players;

            for (var i = 0; i < players.length; i++) {
                if (players[i].userId == userId) {
                    GameLib.log(self._id, players[i].name + " quit the game.");
                    if (state.turn == i)
                        Game._nextTurn(self);
                    players.splice(i, 1);
                    GameLib.updateState(self._id, state);
                    return true;
                }
            }
            return true;
        },

        _doAction: function (self, userId, action, args) {
            var state = self.state;
            var player = state.players[state.turn];

            // return if it's not your turn yet
            if (player.userId != userId && state.phase != 'reveal')
                return false;

            // TODO i don't think this is supposed to happen, that it's your turn and you've folded...
            if (player.folded && state.phase != 'reveal')
                Game._nextTurn(self);
            else {
                if (state.phase.indexOf('betting') >= 0) {
                    if (action == 'raise') {
                        var raise = parseInt(args);
                        if(player.chips < state.call + raise - player.portion)
                            throw new Meteor.Error('poker-not-enough-chips');

                        GameLib.log(self._id, player.name + " raised by ¤" + raise);
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

                        GameLib.log(self._id, player.name + " called for ¤" + state.call);
                        player.portion = state.call;
                        state.pot += diff;
                        player.chips -= diff;
                    }
                    else if (action == 'fold') {
                        GameLib.log(self._id, player.name + " folds");
                        player.cards = [ ];
                        player.folded = true;
                    }
                    else
                        return false;

                    Game._nextTurn(self);
                }
                else if (state.phase == 'trading') {
                    if (action == 'trade') {
                        console.log(args);
                        GameLib.log(self._id, player.name + " trades in " + ( args.length ? args.length + " cards" : "no cards" ) );
                        Game._tradeCards(self, state.turn, args);
                        Game._nextTurn(self);
                    }
                    else
                        return false;
                }
                else if (state.phase == 'reveal') {
                    if (action == 'ready') {
                        var player = state.players[Game._getPlayerNum(self, userId)];
                        player.cards = [ ];
                        console.log(state.players.every(function (value) { console.log('every', value.type, value.cards); return value.type == 'computer' || value.cards == null; }));
                        if (state.players.every(function (value) { return value.type == 'computer' || value.cards; }))
                            Game._startRound(self);
                    }
                    else
                        return false;
                }
            }
            return true;
        },

        _computersTurn: function (self, userId) {
            var state = self.state;
            console.log('computers turn', state.players[state.turn]);
            if (state.players[state.turn].type != 'computer')
                return;

            try {
                if (state.phase.indexOf('betting') >= 0)
                    Game.action(self, userId, 'call');
                else if (state.phase == 'trading')
                    Game.action(self, userId, 'trade', [ ]);
                else
                    Game._nextTurn(self);
                    //Game.action(self, userId, 'ready');
            }
            catch (error) {
                console.log("error during computer's turn", error);
                Game.action(self, userId, 'fold');
            }
            GameLib.updateState(self._id, state);
        },

        _startRound: function (self) {
            var state = self.state;
            GameLib.log(self._id, "starting new round");

            state.deck = Array(52).fill().map(function (current, index, array) { return index + 1; });
            GameLib.shuffle(state.deck);

            var players = state.players;

            for (var j in players) {
                players[j].portion = 0,
                players[j].folded = false;
                players[j].cards = [ ];
                players[j].message = '';
            }

            for (var i = 0; i < 5; i++) {
                for (var j in players)
                    Game._dealCard(self, j);
                //players[j].cards.sort(function(a, b) { return (((b - 1) % 13) + 1) - (((a - 1) % 13) + 1); });
            }

            state.phase = 'betting1';
            state.first = Game._nextPlayer(self, state.first);
            state.turn = state.first;
            state.call = 1;
            state.message = '';
            GameLib.log(self._id, state.players[state.turn].name + " goes first");

            // check if the computer should play the next round
            if (state.players[state.turn].type == 'computer') {
                Meteor.setTimeout(function () {
                    Game._computersTurn(self, '');
                }, 100);
            }
        },

        _endRound: function (self) {
            var state = self.state;
            state.phase = 'reveal';

            var score, highest, winner;
            for (var i in state.players) {
                if (!state.players[i].folded) {
                    score = Game._calculateScore(state.players[i].cards);
                    state.players[i].message = Game._scoreName(score);

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

            GameLib.log(self._id, state.message);
            GameLib.log(self._id, "round ended");

            for (var i in state.players) {
                if (state.players[i].chips <= 0) {
                    GameLib.log(self._id, state.players[i].name + " is out of chips.");
                    state.players.splice(i, 1);
                }
            }
            //GameLib.updateState(self._id, state);
        },

        _nextTurn: function (self) {
            var state = self.state;
            for (var i = state.turn + 1; ; i++) {
                if (i >= state.players.length)
                    i = 0;
                if (i == state.turn)
                    break;
                if (i == state.first)
                    Game._nextPhase(self);
                if (!state.players[i].folded) {
                    state.turn = i;
                    return;
                }
            }

            console.log("everyone's out, next round?");
            Game._endRound(self);
        },

        _nextPhase: function (self) {
            var state = self.state;
            if (state.phase.indexOf('betting') >= 0 && state.players.some(function (current) { return !current.folded && current.portion != state.call; }))
                return;

            if (state.phase == 'betting1')
                state.phase = 'trading';
            else if (state.phase == 'trading') {
                state.call += 1;
                state.phase = 'betting2';
            }
            else if (state.phase == 'betting2') {
                state.phase = 'reveal';
                Game._endRound(self);
            }
        },

        _nextPlayer: function (self, current) {
            current += 1;
            return (current < self.state.players.length) ? current : 0;
        },

        _dealCard: function (self, playerNum) {
            self.state.players[playerNum].cards.push(self.state.deck.shift());
        },
                    
        _tradeCards: function (self, playerNum, cards) {
            var hand = self.state.players[playerNum].cards;

            for (var i in cards) {
                var index = hand.indexOf(parseInt(cards[i]));
                if (index >= 0)
                    hand.splice(index, 1);
            }

            var newCards = 5 - hand.length;
            for (var i = 0; i < newCards; i++)
                Game._dealCard(self, playerNum);
        },

        _getPlayerNum: function (self, userId) {
            for (var i in self.state.players) {
                if (self.state.players[i].userId == userId)
                    return i;
            }
            return null;
        },

        _calculateScore: function (hand) {
            var cards = [ ];
            for (var i = 0; i < hand.length; i++) {
                var suit = Math.floor((hand[i] - 1) / 13);
                var rank = ((hand[i] - 1) % 13) + 1;
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
                    return 'a straight flush, ' + Game._cardName(score[1]) + ' high';
                case 8:
                    return 'four of a kind of ' + Game._cardName(score[1], true);
                case 7:
                    return 'a full house, ' + Game._cardName(score[1]) + ' high';
                case 6:
                    return 'a flush, ' + Game._cardName(score[1]) + ' high';
                case 5:
                    return 'a straight, ' + Game._cardName(score[1]) + ' high';
                case 4:
                    return 'three of a kind of ' + Game._cardName(score[1], true);
                case 3:
                    return 'two pairs, ' + Game._cardName(score[1]) + ' high';
                case 2:
                    return 'a pair of ' + Game._cardName(score[1], true);
                case 1:
                    return 'high card, ' + Game._cardName(score[1]);
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

    });

    Meteor.startup(function () {
        GameLib.Types.add({
            name: 'poker',
            title: 'Poker',
            template: 'Games_Poker',
            methods: Game,
            minslots: 2,
            maxslots: 4,
        });
    });
}


