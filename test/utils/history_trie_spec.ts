import "mocha";
import {expect} from "chai";
import {HistoryTrie} from "../../src/utils/HistoryTrie";

function getSuggestions(history: string[], input: string): string[] {
    const trie = new HistoryTrie();
    history.forEach(string => trie.add(string));
    return trie.getContinuationsFor(input).map(prefix => prefix.value + (prefix.space ? " " : ""));
}

describe("HistoryTrie", () => {
    it("finds next common prefixes", () => {
        const history = [
            "git commit",
            "git checkout",
        ];
        const input = "git ";
        const suggestions = [
            "commit",
            "checkout",
        ];

        expect(getSuggestions(history, input)).to.eql(suggestions);
    });

    it("finds first word", () => {
        const history = [
            "git commit",
            "git checkout",
        ];
        const input = "gi";
        const suggestions = [
            "git ",
        ];

        expect(getSuggestions(history, input)).to.eql(suggestions);
    });

    it("finds single continuation", () => {
        const history = [
            "git commit",
            "git checkout",
        ];
        const input = "git co";
        const suggestions = [
            "commit",
        ];

        expect(getSuggestions(history, input)).to.eql(suggestions);
    });

    it("finds next word", () => {
        const history = [
            "git commit",
            "git checkout master",
        ];
        const input = "git c";
        const suggestions = [
            "commit",
            "checkout ",
        ];

        expect(getSuggestions(history, input)).to.eql(suggestions);
    });

    it("finds longest prefix", () => {
        const history = [
            "git commit",
            "git checkout master --option",
        ];
        const input = "git ch";
        const suggestions = [
            "checkout ",
            "checkout master --option",
        ];

        expect(getSuggestions(history, input)).to.eql(suggestions);
    });

    it("is ordered by frequency", () => {
        const history = [
            "git status",
            "git pull",
            "git pull",
        ];
        const input = "git ";
        const suggestions = [
            "pull",
            "status",
        ];

        expect(getSuggestions(history, input)).to.eql(suggestions);
    });

    it("is fuzzy matches", () => {
        const history = [
            "git cherry-pick",
        ];
        const input = "git pi";
        const suggestions = [
            "cherry-pick",
        ];

        expect(getSuggestions(history, input)).to.eql(suggestions);
    });

    it("considers a string literal a single token", () => {
        const history = [
            "git commit -m 'first message'",
            "git commit -m 'second message'",
        ];
        const input = "git commit -m ";
        const suggestions = [
            "'first message'",
            "'second message'",
        ];

        expect(getSuggestions(history, input)).to.eql(suggestions);
    });

    it("gives no results for empty input", () => {
        const history = [
            "git log",
        ];
        const input = "";
        const suggestions: string[] = [];

        expect(getSuggestions(history, input)).to.eql(suggestions);
    });
});
