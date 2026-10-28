import json

from build_titles import build, norm


def test_norm_drops_accents_and_signs():
    assert norm("Café del Mar!") == "cafedelmar"
    assert norm("  The 1st ") == "the1st"


def test_index_lists_map_and_vault_titles_and_splits_big_keys(tmp_path, monkeypatch):
    import build_titles
    monkeypatch.setattr(build_titles, "MAX_BYTES", 200)
    (tmp_path / "titles").mkdir()
    (tmp_path / "vault" / "0").mkdir(parents=True)
    (tmp_path / "map.json").write_text(json.dumps({"stars": [{"name": "House"}], "meta": {"shard": 10}}))
    titles = ["Strings Of Life", "Strings Of Life", "Stringer", "Moon"]
    (tmp_path / "titles" / "0.json").write_text(json.dumps({"t": "\n".join(titles), "an": "Rhythim Is Rhythim\nX", "a": [0, 0, 1, 1]}))
    (tmp_path / "vault" / "0" / "1.json").write_text(json.dumps({"yt": "", "yr": [1], "t": "Strobe", "an": "Y", "a": [0]}))
    out = build(tmp_path)
    assert out["titles"] == 4  # the same title by the same artist once
    split = json.loads((tmp_path / "search" / "index.json").read_text())["split"]
    found = {}
    for f in (tmp_path / "search").glob("*.json"):
        if f.name == "index.json":
            continue
        d = json.loads(f.read_text())
        for t, i in zip(d["t"].split("\n"), d["i"], strict=True):
            found[t] = (f.stem, i)
    assert found["Moon"] == ("mo", 3)
    assert found["Strobe"][1] == -1 - 10  # vault position 10: shard 1, first track
    assert all(found[t][0].startswith("st") for t in ("Strings Of Life", "Stringer", "Strobe"))
    assert ("st" in split) == (found["Strobe"][0] != "st")
