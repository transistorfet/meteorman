
'use strict';

if (Meteor.isServer) {

    global.StateMachine = function () {
        this.rules = [ ];
        this.helpers = { };
    }

    global.StateMachine.prototype = {
        addRule: function (rule) {
            if ('actions' in rule ^ 'run' in rule)
                this.rules.push(rule);
            else
                console.log('error adding rule:', rule);
        },

        addHelper: function(name, helper) {
            this.helpers[name] = helper;
        },

        applyRuns: function (object) {
            var argslist = [ ];

            for (var applications = 0; applications < 20; applications++) {
                for (var i = 0; i < this.rules.length; i++) {
                    var rule = this.rules[i];

                    if (this.checkCondition(rule, object, argslist) && 'run' in rule)
                        break;
                }

                if (i >= this.rules.length) {
                    console.log('no rules matched');
                    return false;
                }

                console.log('applying run rule', rule);
                var result = rule.run.apply(object, argslist);

                if (this.checkResult(rule, result, object, argslist) == false) {
                    console.log('rule run failed');
                    return false;
                }

                console.log('success, therefore looping');
            }

            console.log('rule application limit reached');
            return false;
        },

        applyAction: function (object, userId, action, args) {
            var argslist = [ userId, action, args ];

            for (var i = 0; i < this.rules.length; i++) {
                var rule = this.rules[i];

                // check if the condition matches
                if (!this.checkCondition(rule, object, argslist))
                    continue;

                // we are still here, so the conditions matched
                // TODO this isn't right... if we are doing an action, then we shouldn't just run a rule (unless we later loop until we find an action or fail)
                //if ('run' in rule) {
                //    var result = rule.run.apply(object, argslist);
                //}
                if ('actions' in rule) {
                    if (!(action in rule.actions))
                        continue;
                    console.log('applying action rule', rule);
                    var result = rule.actions[action].apply(object, argslist);
                }
                else
                    continue;

                return this.checkResult(rule, result, object, argslist);
            }

            console.log('no rules matched');
            return false;
        },

        matchRule: function (object, argslist) {
            for (var i = 0; i < this.rules.length; i++) {
                if (this.checkCondition(this.rules[i], object, argslist))
                    return this.rules[i];
            }
            return null;
        },

        checkCondition: function (rule, object, argslist) {
            if (typeof(rule.condition) == 'function')
                return rule.condition.apply(object, argslist);
            else {
                for (var key in rule.condition) {
                    if (key.startsWith('$')) {
                        if (!this.helpers[key.substr(1)].apply(object, argslist))
                            return false;
                    }
                    else {
                        if (!(key in object.state))
                            return false;

                        if (rule.condition[key] instanceof RegExp) {
                            if (!(object.state[key].match(rule.condition[key])))
                                return false;
                        }
                        else {
                            if (object.state[key] != rule.condition[key])
                                return false;
                        }
                    }
                }
                return true;
            }
        },

        checkResult: function (rule, result, object, argslist) {
            // run success or error functions based on result
            if (result !== false) {
                if ('success' in rule)
                    rule.success.apply(object, [ result, argslist ]);
                console.log('rule success', object.state);
                return true;
            }
            else {
                console.log('rule failure');
                if ('error' in rule)
                    rule.error.apply(object, [ argslist ]);
                return false;
            }
        },

    };

}

