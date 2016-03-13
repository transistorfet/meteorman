
'use strict';

var Global = Meteor.isClient ? window : global;

Global.CardUtils = Object.assign(Global.CardUtils || {}, {
    rankAndSuit: function (card) {
        var suit = Math.floor((card - 1) / 13);
        var rank = ((card - 1) % 13) + 1;
        return [ rank, suit ];
    },

    rank: function (card) {
        return ((card - 1) % 13) + 1;
    },

    suit: function (card) {
        return Math.floor((card - 1) / 13);
    },
});

if (Meteor.isServer) {

    var defaults = {
        type: '52',
        sets: 1,
        jokers: 0,
        shuffle: true,
    };

    Global.CardUtils = Object.assign(Global.CardUtils || {}, {
        makeDeck: function (options) {
            console.log('before', options);
            options = Object.assign({}, defaults, options);
            console.log('after', options);

            // TODO specify number of decks, type of deck (52, 56, 36, 78 cards), whether to include jokers, whether to shuffle it?
            if (options.type == '52')
                var deck = Array(52 * options.sets).fill().map(function (current, index, array) { return (index % 52) + 1; });

            // TODO should there be different jokers?  Should there be a number for each colour joker, or a number for each joker (if more than 2)
            if (options.jokers > 0)
                deck.concat(Array(options.jokers).fill(53));

            if (options.shuffle)
                GameUtils.shuffle(deck);
            return deck;
        },

        sortByRank: function (cards) {
            cards.sort(function(a, b) { return (((a - 1) % 13) + 1) - (((b - 1) % 13) + 1); });
            return cards;
        },

        sortByRankAndSuit: function (cards) {
            cards.sort(function(a, b) { return a - b; });
            return cards;
        },

        /*
        rankAndSuit: function (card) {
            var suit = Math.floor((card - 1) / 13);
            var rank = ((card - 1) % 13) + 1;
            return [ rank, suit ];
        },

        rank: function (card) {
            return ((card - 1) % 13) + 1;
        },

        suit: function (card) {
            return Math.floor((card - 1) / 13);
        },
        */

        isNotCard: function (card) {
            return (card >= 1 && card <= 53) ? false : true;
        },

        isJoker: function (card) {
            return (card == 53);
        },

        isFaceCard: function (card) {

        },

        isSuit: function (card, suit) {

        },

        isRank: function (card, rank) {

        },

        backOfCard: function () {
            return 54;
        },

        pokerName: function (score) {
            switch (score[0]) {
                case 9:
                    return 'a straight flush, ' + CardUtils.rankName(score[1]) + ' high';
                case 8:
                    return 'four of a kind of ' + CardUtils.rankName(score[1], true);
                case 7:
                    return 'a full house, ' + CardUtils.rankName(score[1]) + ' high';
                case 6:
                    return 'a flush, ' + CardUtils.rankName(score[1]) + ' high';
                case 5:
                    return 'a straight, ' + CardUtils.rankName(score[1]) + ' high';
                case 4:
                    return 'three of a kind of ' + CardUtils.rankName(score[1], true);
                case 3:
                    return 'two pairs, ' + CardUtils.rankName(score[1]) + ' high';
                case 2:
                    return 'a pair of ' + CardUtils.rankName(score[1], true);
                case 1:
                    return 'high card, ' + CardUtils.rankName(score[1]);
                default:
                    return 'invalid hand type';
            }
        },

        rankName: function (card, plural) {
            var name = (function () {
                switch (CardUtils.rank(card)) {
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

}

