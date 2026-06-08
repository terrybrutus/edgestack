import Map "mo:core/Map";
import HistoryTypes "../types/history";

module {
  type OldActor = {};

  type NewActor = {
    betHistory : Map.Map<Text, HistoryTypes.BetRecommendation>;
    lineOpenStore : Map.Map<Text, Text>;
    OPENAI_API_KEY : Text;
  };

  public func migration(_ : OldActor) : NewActor {
    {
      betHistory = Map.empty<Text, HistoryTypes.BetRecommendation>();
      lineOpenStore = Map.empty<Text, Text>();
      OPENAI_API_KEY = "";
    };
  };
};
