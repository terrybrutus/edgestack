import Map "mo:core/Map";
import List "mo:core/List";
import HistoryTypes "../types/history";

module {
  type Item = {
    id : Nat;
    title : Text;
    status : { #todo; #done };
  };

  // Matches the previous canister version (Caffeine template items actor)
  type OldActor = {
    items : List.List<Item>;
    state : { var nextId : Nat };
  };

  type NewActor = {
    betHistory : Map.Map<Text, HistoryTypes.BetRecommendation>;
    lineOpenStore : Map.Map<Text, Text>;
    _OPENAI_API_KEY : Text;
  };

  public func migration(_ : OldActor) : NewActor {
    {
      betHistory = Map.empty<Text, HistoryTypes.BetRecommendation>();
      lineOpenStore = Map.empty<Text, Text>();
      _OPENAI_API_KEY = "";
    };
  };
};
