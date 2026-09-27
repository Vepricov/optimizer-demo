"""Prepare the offline demo from published measurements; never train models."""

from __future__ import annotations

import json
import hashlib
import math
import re
import statistics
import urllib.request
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parent
LLM_URL = "https://arxiv.org/html/2607.20548v1"
FANTASTIC_URL = "https://arxiv.org/html/2509.02046v2"
DYKAF_URL = "https://arxiv.org/html/2511.06477v1"
SOFTSIGN_URL = "https://arxiv.org/html/2605.31371v1"
LABELS = {
    "adult": ("Доход человека", "Adult"),
    "black-friday": ("Покупки", "Black Friday"),
    "california": ("Стоимость жилья", "California Housing"),
    "churn": ("Отток клиентов", "Churn"),
    "diamond": ("Стоимость бриллиантов", "Diamond"),
    "higgs-small": ("Физика частиц", "Higgs Small"),
    "house": ("Стоимость жилья", "House 16H"),
    "microsoft": ("Поисковая релевантность", "Microsoft"),
    "otto": ("Категории товаров", "Otto Products"),
    "tabred/cooking-time": ("Время приготовления", "Cooking Time"),
    "tabred/delivery-eta": ("Время доставки", "Delivery ETA"),
    "tabred/ecom-offers": ("Отклик на предложение", "Ecom Offers"),
    "tabred/homecredit-default": ("Кредитный скоринг", "Homecredit Default"),
    "tabred/homesite-insurance": ("Страхование", "Homesite Insurance"),
    "tabred/maps-routing": ("Маршрутизация", "Maps Routing"),
    "tabred/sberbank-housing": ("Стоимость жилья", "Sberbank Housing"),
    "tabred/weather": ("Прогноз погоды", "Weather"),
}


class TableParser(HTMLParser):
    """Read HTML table cells, excluding duplicate MathML annotations."""

    def __init__(self) -> None:
        super().__init__()
        self.tables: list = []
        self.depth = 0
        self.rows: list = []
        self.row: list = []
        self.cell: list = []
        self.in_cell = False
        self.skip = 0

    def handle_starttag(self, tag: str, attrs: list) -> None:
        if tag == "table":
            self.depth += 1
        if self.depth and tag == "tr":
            self.row = []
        if self.depth and tag in ("th", "td"):
            self.in_cell, self.cell = True, []
        if self.in_cell and tag == "annotation":
            self.skip += 1

    def handle_endtag(self, tag: str) -> None:
        if tag == "annotation" and self.skip:
            self.skip -= 1
        if self.depth and tag in ("th", "td"):
            self.row.append(" ".join("".join(self.cell).split()))
            self.in_cell = False
        if self.depth and tag == "tr":
            self.rows.append(self.row)
        if tag == "table":
            self.depth -= 1
            if not self.depth:
                self.tables.append(self.rows)
                self.rows = []

    def handle_data(self, data: str) -> None:
        if self.in_cell and not self.skip:
            self.cell.append(data)


def fetch(url: str) -> str:
    with urllib.request.urlopen(url, timeout=30) as response:
        return response.read().decode()


def budget_at_loss(budgets: list, losses: list, target: float) -> float | None:
    """Interpolate log budget within measured endpoints, without extrapolation."""
    for i in range(1, len(budgets)):
        if losses[i] <= target <= losses[i - 1] and losses[i] < losses[i - 1]:
            fraction = (target - losses[i - 1]) / (losses[i] - losses[i - 1])
            return math.exp(math.log(budgets[i - 1]) + fraction * math.log(budgets[i] / budgets[i - 1]))
    return None


def economy_data() -> dict:
    """Source-backed fixed coefficients, separated from the user's cost assumptions."""
    methods = {name: [] for name in ("Muon", "SOAP", "DyKAF", "SoftMuon", "SoftSignum",
                                    "Kron", "Scion", "NAdamW", "Mars", "Lion", "Cautious", "Adam-Mini")}
    provenance = []
    raw = fetch(FANTASTIC_URL)
    provenance.append({"url": FANTASTIC_URL, "sha256": hashlib.sha256(raw.encode()).hexdigest()})
    tables = {}
    for figure in re.findall(r'<figure\b[^>]*>[\s\S]*?</figure>', raw):
        caption = re.search(r'Evaluation Performance for (.*?), Model Size = (\d+)m', figure)
        if not caption:
            continue
        parser = TableParser()
        parser.feed(figure)
        table = parser.tables[0]
        assert table[-1][0] == "FINAL C4 LOSS"
        anchor = re.search(r'id="([^"]+)"', figure).group(1)
        tables[(caption[1], caption[2])] = {
            "budgets": [float(x[:-1]) for x in table[0][1:]],
            "losses": [float(x) for x in table[-1][1:]], "anchor": anchor,
        }
    assert len(tables) == 30
    for (method, scale), row in tables.items():
        if method == "AdamW":
            continue
        baseline = tables[("AdamW", scale)]
        assert row["budgets"] == baseline["budgets"]
        for budget, loss in zip(baseline["budgets"], baseline["losses"]):
            needed = budget_at_loss(row["budgets"], row["losses"], loss)
            if needed is None:
                continue
            methods[method].append({
                "id": f"fantastic-{method}-{scale}-{budget:g}",
                "label": f"LLaMA {scale}M · C4 · AdamW {budget:g}B токенов",
                "factor": budget / needed, "target": f"C4 loss {loss:.3f}",
                "baseline_budget": budget, "method_budget": needed, "unit": "B токенов",
                "source": FANTASTIC_URL + "#" + row["anchor"],
                "baseline_source": FANTASTIC_URL + "#" + baseline["anchor"],
                "source_name": "Fantastic Pretraining Optimizers · Appendix B.4",
                "kind": "Интерполяция таблицы",
                "detail": "Линейная интерполяция loss по логарифму числа токенов между опубликованными конечными моделями. Гиперпараметры настроены отдельно для каждого метода. Коэффициент относится к токенам, не к измеренному времени.",
                "points": {"budget": row["budgets"], "adamw": baseline["losses"], "method": row["losses"]},
            })

    raw = fetch(DYKAF_URL)
    provenance.append({"url": DYKAF_URL, "sha256": hashlib.sha256(raw.encode()).hexdigest()})
    figure = next(f for f in re.findall(r'<figure\b[^>]*>[\s\S]*?</figure>', raw) if 'id="S6.T4"' in f)
    parser = TableParser()
    parser.feed(figure)
    table = parser.tables[0]
    budgets = [float(x[:-1]) for x in table[0][1:-1]]
    rows = {r[0]: [float(x) for x in r[1:-1]] for r in table[2:]}
    assert rows["DyKAF"][-1] == 3.1986
    for budget, loss in zip(budgets, rows["AdamW"]):
        needed = budget_at_loss(budgets, rows["DyKAF"], loss)
        if needed is None:
            continue
        methods["DyKAF"].append({
            "id": f"dykaf-{budget:g}", "label": f"LLaMA 124M · FineWeb · AdamW {budget:g}B токенов",
            "factor": budget / needed, "target": f"Validation loss {loss:.4f}",
            "baseline_budget": budget, "method_budget": needed, "unit": "B токенов",
            "source": DYKAF_URL + "#S6.T4", "baseline_source": DYKAF_URL + "#S6.T4",
            "source_name": "DyKAF · Table 4", "kind": "Интерполяция таблицы",
            "detail": "Линейная интерполяция loss по логарифму числа токенов. Использована публичная Table 4, не более поздние внутренние эксперименты. Базовые методы перенесены авторами из бенчмарка Semenov et al.; DyKAF использует настройки SOAP. Время шага в этот коэффициент не входит.",
            "points": {"budget": budgets, "adamw": rows["AdamW"], "method": rows["DyKAF"]},
        })

    svg_url = SOFTSIGN_URL + "/llm_pretraining.svg"
    raw = fetch(svg_url)
    provenance.append({"url": svg_url, "sha256": hashlib.sha256(raw.encode()).hexdigest()})
    curves = {}
    for path in ET.fromstring(raw).iter("{http://www.w3.org/2000/svg}path"):
        color, coordinates = path.get("stroke"), path.get("d", "")
        if color not in ("#d55e00", "#0072b2", "#009e73") or len(coordinates) < 150:
            continue
        assert path.get("transform") == "matrix(1,0,0,-1,0,849.5118)"
        assert re.sub(r"[\d.\-\sM]", "", coordinates) == ""
        numbers = [float(x) for x in re.findall(r"-?\d+(?:\.\d+)?", coordinates)]
        points = list(zip(numbers[::2], numbers[1::2]))
        scale = "130" if points[0][1] > 500 else "360"
        curves[(scale, color)] = points
    for (scale, color), points in curves.items():
        if color == "#009e73":
            continue
        method = "SoftMuon" if color == "#d55e00" else "SoftSignum"
        baseline = curves[(scale, "#009e73")]
        start, end = (76000, 100000) if scale == "130" else (34000, 44000)
        target = baseline[-1][1]
        for (x0, y0), (x1, y1) in zip(points, points[1:]):
            if y1 <= target <= y0:
                x = x0 + (target - y0) / (y1 - y0) * (x1 - x0)
                needed = start + (x - baseline[0][0]) / (baseline[-1][0] - baseline[0][0]) * (end - start)
                methods[method].append({
                    "id": f"softsign-{method}-{scale}",
                    "label": f"{'LLaMA 130M · C4' if scale == '130' else 'SmolLM2 360M · FineWeb-Edu'} · Figure 2",
                    "factor": end / needed, "target": f"Perplexity AdamW на шаге {end:,}".replace(",", " "),
                    "baseline_budget": end, "method_budget": needed, "unit": "шагов",
                    "source": SOFTSIGN_URL + "#S4.F2", "baseline_source": svg_url,
                    "source_name": "Softsign · Figure 2", "kind": "Оценка по графику",
                    "detail": "Пересечение векторной кривой с уровнем perplexity AdamW в конце показанного участка, с линейной интерполяцией между вершинами. Это промежуточная точка длинного запуска, а не финал отдельно обученной короткой модели. Приближённый коэффициент по шагам; одинаковый batch, время шага не измерено.",
                })
                break
    result = []
    for name, scenarios in methods.items():
        assert scenarios, name
        scenarios.sort(key=lambda s: s["factor"], reverse=True)
        result.append({"name": name, "scenarios": scenarios})
    return {"methods": result, "provenance": provenance,
            "selection": "По умолчанию выбран наибольший расчётный коэффициент среди загруженных сопоставимых точек данного метода. Это выбранный пример, не универсальная гарантия ускорения."}


def main() -> None:
    source = json.loads((ROOT / "source-bundle.json").read_text())
    tabular = []
    for dataset, (name, label) in LABELS.items():
        rows = {r["optimizer"]: r for r in source["tabular"] if r["dataset"] == dataset}
        metrics = rows["adamw"]["experiments"][0]["report"]["metrics"]["test"]
        key = "rmse" if "rmse" in metrics else "roc-auc" if "roc-auc" in metrics else "accuracy"
        record = {"id": dataset, "name": name, "dataset": label, "metric": key,
                  "lower": key == "rmse", "methods": {}}
        for method, row in rows.items():
            experiments = row["experiments"]
            values = [e["report"]["metrics"]["test"][key] for e in experiments]
            assert len(values) == 10
            record["methods"][method] = {
                "mean": statistics.mean(values), "sd": statistics.stdev(values), "n": 10,
                "seconds": statistics.mean(e["report"]["time"] for e in experiments),
                "values": values, "architecture": experiments[0]["config"]["model"],
                "source": row["source_url"],
            }
        tabular.append(record)

    diffusion = {}
    for method in ("adamw", "muon", "soap"):
        rows = [r for r in source["diffusion"] if r["config"]["opt"]["name"] == method
                and (method != "adamw" or r["config"]["opt"]["lr"] == 0.00045)]
        assert len(rows) == 3
        series, elapsed, smoothed = [], 0.0, None
        for i in range(1024):
            loss = statistics.mean(r["history"][i]["val_loss"] for r in rows)
            elapsed += statistics.mean(r["history"][i]["epoch_train_time"] for r in rows) / 60
            smoothed = loss if smoothed is None else 0.95 * smoothed + 0.05 * loss
            values = [statistics.mean(e["val_loss"] for e in r["history"][max(0, i - 4):i + 1])
                      for r in rows]
            series.append({"epoch": i + 1, "loss": loss, "display_loss": statistics.mean(values),
                           "sd": statistics.stdev(values), "ema": smoothed, "train_minutes": elapsed})
        diffusion[method] = {"series": series, "n": 3, "config": rows[0]["config"],
                             "sources": [r["source_url"] for r in rows]}

    parser = TableParser()
    with urllib.request.urlopen(LLM_URL, timeout=30) as response:
        parser.feed(response.read().decode())
    tables = [t for t in parser.tables if any("NVIDIA-Nemotron" in cell for row in t for cell in row)]
    assert len(tables) == 1
    llm = []
    columns = ("muon3", "muon2", "muon1", "adamw1", "hybrid_muon2", "hybrid_adamw1")
    for row in tables[0]:
        if len(row) != 7:
            continue
        try:
            values = [float(value) for value in row[1:]]
        except ValueError:
            continue
        llm.append({"name": row[0], **dict(zip(columns, values))})
    assert len(llm) == 15
    assert next(r for r in llm if r["name"] == "MMLU PRO CoT")["muon1"] == 58.19

    sources = [
        {"name": "SOAP, Muon, and Beyond", "domain": "LLM", "url": LLM_URL + "#S5.T5",
         "status": "Загружено", "detail": "Table 5: 15 метрик. Nano-V3, Muon 1× и AdamW 1×: одинаковые архитектура, 3T токенов и batch. Число повторов и интервалы в таблице не указаны."},
        {"name": "Benchmarking Optimizers for MLPs in Tabular Deep Learning", "domain": "Табличные данные",
         "url": "https://arxiv.org/abs/2604.15297", "status": "Загружено",
         "detail": "17 датасетов, 10 seeds. Совместный подбор архитектуры и оптимизатора. Commit: " + source["sources"]["tabular"]["commit"]},
        {"name": "Optimization Benchmark for Diffusion Models on Dynamical Systems", "domain": "Диффузия",
         "url": "https://arxiv.org/abs/2510.19376", "status": "Загружено",
         "detail": "U-Net 22.9M, 1024 эпохи, 3 seeds. Логи AdamW/Muon/SOAP; время только обучения. Commit: " + source["sources"]["diffusion"]["commit"]},
        {"name": "Fantastic Pretraining Optimizers and Where to Find Them", "domain": "LLM · расширение",
         "url": FANTASTIC_URL, "status": "Загружено",
         "detail": "Appendix B.4: конечный C4 loss, 130M/300M/520M, четыре бюджета. Коэффициенты экономии рассчитаны интерполяцией, время шага задаётся отдельно."},
        {"name": "Benchmarking Optimizers for Large Language Model Pretraining", "domain": "LLM · расширение",
         "url": "https://arxiv.org/abs/2509.01440", "status": "Следующий источник",
         "detail": "Разные масштабы, batch sizes и горизонты. Работа изучает loss, а не downstream-метрики."},
        {"name": "Training Diffusion Transformers with Muon", "domain": "Генерация изображений · расширение",
         "url": "https://sven-luepke.github.io/blog/2026-05-31-dit-muon/", "status": "Кандидат",
         "detail": "Авторские эксперименты DiT на ImageNet, метрика FID. Доступность полных логов и samples ещё требует проверки."},
        {"name": "Scaling Muon for Diffusion Transformers", "domain": "Генерация изображений · расширение",
         "url": "https://arxiv.org/abs/2608.20818", "status": "Кандидат",
         "detail": "Масштабы 1.3B–15B. Пригодность публичных артефактов для интерфейса ещё не проверена."},
    ]
    sources.extend([
        {"name": "DyKAF", "domain": "Экономия · pretraining", "url": DYKAF_URL + "#S6.T4",
         "status": "Загружено", "detail": "Публичная Table 4: LLaMA-124M / FineWeb, шесть бюджетов. Коэффициент по токенам при одинаковом loss оценён интерполяцией."},
        {"name": "Softsign / SoftMuon", "domain": "Экономия · pretraining", "url": SOFTSIGN_URL + "#S4.F2",
         "status": "Загружено", "detail": "Figure 2: 130M / C4 и 360M / FineWeb-Edu. Приближённый time-to-target по векторному графику, не измеренное ускорение полного обучения."},
    ])
    data = {"scope": {"own_training_runs": 0, "focus": "cost_at_matched_quality", "game_mode": False},
            "tabular": tabular, "diffusion": diffusion, "llm": llm, "sources": sources,
            "economy": economy_data()}
    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":"), allow_nan=False).replace("</", "<\\/")
    (ROOT / "data.js").write_text("window.DEMO_DATA = " + payload + ";\n")


if __name__ == "__main__":
    main()
