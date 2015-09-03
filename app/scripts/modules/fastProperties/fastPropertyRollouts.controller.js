'use strict';

let angular = require('angular');

module.exports = angular
  .module('spinnaker.fastProperties.rollouts.controller', [
    require('./fastProperty.read.service.js'),
    require('./fastProperty.write.service.js'),
    require('./fastPropertyTransformer.service.js'),
    require('../utils/lodash.js'),
  ])
  .controller('FastPropertyRolloutController', function ($scope, fastPropertyReader, fastPropertyWriter, fastPropertyTransformer, _) {
    var vm = this;

    vm.applicationFilter = '';
    vm.promotionStateFilter = 'Running';

    vm.filter = function() {
      if (!_(vm.applicationFilter).isEmpty()) {
        vm.filteredPromotions = vm.promotions.filter(function(promotion) {
          return promotion.scopes.from.appId.indexOf(vm.applicationFilter) > -1;
        });
      } else {
        vm.filteredPromotions = vm.promotions;
      }
    };

    vm.continue = function(promotionId) {
      fastPropertyWriter.continuePromotion(promotionId).then(loadPromotions);
    };

    vm.stop= function(promotionId) {
      window.alert('Stop with: ' + promotionId);
    };

    vm.getLastMessage = function(promotion) {
      return _(promotion.history).last().message;
    };

    vm.updateStateFilter = function(state) {
      if(state) {
        vm.filteredPromotions = vm.promotions.filter(function(promotion) {
          return promotion.state === state;
        });
      } else {
        vm.filteredPromotions = vm.promotions;
      }
    };

    function loadPromotions() {
      fastPropertyReader.loadPromotions()
        .then(function(promotionList) {
          vm.promotions = vm.filteredPromotions = promotionList;
          vm.filter();
          return vm.promotions;
        })
        .then(fastPropertyTransformer.sortRunningPromotionsFirst)
        .then(function(sortedPromotions) {
          vm.promotions = sortedPromotions;
          return vm.promotions;
        })
        .then(function(){
          return vm.updateStateFilter(vm.promotionStateFilter);
        }).catch(function(error) {
          console.warn(error);
        });
    }

    loadPromotions();
    return vm;
  }).name;
