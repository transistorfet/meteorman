
'use strict';

if (Meteor.isClient) {
    var TileInfo = {
        'width': 32,
        'height': 48,
        'numx': 16,
        'numy': 4
    }

    var PlayArea = (function ()
    {
        var Constructor = function ()
        {
            return this;
        }

        var Proto = Constructor.prototype;

        Proto.update_tile = function (element, tile)
        {
            if (tile !== undefined)
                $(element).attr('data-card', tile);

            var tile = $(element).attr('data-card');
            var x = (tile % TileInfo.numx) * TileInfo.width;
            var y = Math.floor(tile / TileInfo.numx) * TileInfo.height;
            $(element).css('background-position', '-' + x + 'px -' + y + 'px');
        }

        return Constructor;
    })();


    Template.Games_Blackjack.onCreated(function ()
    {
        var instance = this;
        var playarea = new PlayArea();

        instance.autorun(function () {
            var thing = Template.currentData();

            Tracker.afterFlush(function () {
                console.log("blackjack rerun");
                $('.card').each(function ()
                {
                    playarea.update_tile(this);
                });
            });
        });

    });

    Template.Games_Blackjack.events({
        'click #hit': function () {
            Meteor.call('action', this._id, 'hit');
        },
        'click #stay': function () {
            Meteor.call('action', this._id, 'stay');
        },
        'click #next': function () {
            Meteor.call('action', this._id, 'next');
        },
    });
}

if (Meteor.isServer) {

    Meteor.startup(function () {
        GameLib.Types.add({
            name: 'blackjack',
            title: 'Blackjack',
            template: 'Games_Blackjack',
            methods: Game,
            maxslots: 1,
        });
    });

    var Game = {
        init: function (userId) {
            console.log('init blackjack');
            var state = this.state;

            state.wins = 0;
            state.losses = 0;
        },

        start: function (userId) {
            this.startRound();
            GameLib.updateState(this._id, this.state);
        },

        finish: function (userId) {
            console.log('finish blackjack');
        },

        getPlayerView: function (userId) {
            var state = this.state;

            var view = {
                playing: state.playing,
                player: state.player,
                player_score: this.calculateScore(state.player),
                wins: state.wins,
                losses: state.losses,
                message: state.message,
            };

            if (state.playing) {
                view.dealer = [ state.dealer[0], 54 ];
            }
            else {
                view.dealer = state.dealer;
                view.dealer_score = this.calculateScore(state.dealer);
            }

            return view;
        },

        action: function (userId, action, args) {
            var state = this.state;
            console.log('action', userId, action, args);

            if (state.playing) {
                if (action == 'hit') {
                    GameLib.log(this._id, "player requested a hit");
                    state.player.push(state.deck.shift());
                    var score = this.calculateScore(state.player);
                    if (score > 21)
                        this.endRound();
                }
                else if (action == 'stay') {
                    GameLib.log(this._id, "player requested to stay");
                    this.endRound();
                }
            }
            else {
                if (action == 'next') {
                    GameLib.log(this._id, "starting new round");
                    this.startRound();
                }
            }

            GameLib.updateState(this._id, state);
        },

        startRound: function () {
            var state = this.state;

            state.deck = Array(52).fill().map(function (current, index, array) { return index + 1; });
            GameUtils.shuffle(state.deck);

            state.dealer = [ ];
            state.player = [ ];

            this.dealCard('player');
            this.dealCard('dealer');
            this.dealCard('player');
            this.dealCard('dealer');

            state.playing = true;
            state.message = '';
        },

        endRound: function () {
            var state = this.state;

            state.playing = false;

            var player_score = this.calculateScore(state.player);

            var dealer_score;
            while (true) {
                dealer_score = this.calculateScore(state.dealer);
                if (player_score > 21 || dealer_score >= 17)
                    break;
                this.dealCard('dealer');
            }

            if (player_score > 21) {
                state.losses += 1;
                state.message = "Bust! Dealer Wins";
            }
            else if (dealer_score > 21) {
                state.wins += 1;
                state.message = "Dealer Busts!  You Win";
            }
            else if (player_score > dealer_score) {
                state.wins += 1;
                state.message = "You Win!";
            }
            else {
                state.losses += 1;
                state.message = "Dealer Wins";
            }

            GameLib.log(this._id, state.message);
        },

        dealCard: function (handname) {
            var state = this.state;
            state[handname].push(state.deck.shift());
        },

        calculateScore: function (hand) {
            var score = 0;
            var aces = 0;

            for (var i in hand) {
                var card = Math.min(10, ((hand[i] - 1) % 13) + 1);
                if (card == 1)
                    aces += 1;
                else
                    score += card;
            }

            for (var i = 0; i < aces; i++) {
                if (score + 11 <= 21)
                    score += 11;
                else
                    score += 1;
            }

            return score;
        },

    };

}


