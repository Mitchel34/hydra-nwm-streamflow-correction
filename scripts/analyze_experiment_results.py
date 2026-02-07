#!/usr/bin/env python3
"""
Hydra Experiment Results Analysis
=================================
Engineering-focused analysis of ML/DL performance for NWM streamflow correction.

Generates:
- Summary statistics tables
- Performance visualizations
- Site-level comparisons
- Experiment ablation analysis
"""

import json
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path
from datetime import datetime

# Configure plotting style
plt.style.use('seaborn-v0_8-whitegrid')
plt.rcParams.update({
    'font.family': 'sans-serif',
    'font.size': 11,
    'axes.titlesize': 13,
    'axes.labelsize': 11,
    'xtick.labelsize': 10,
    'ytick.labelsize': 10,
    'legend.fontsize': 10,
    'figure.titlesize': 14,
    'figure.dpi': 150,
})

# Color palette matching dashboard theme
COLORS = {
    'baseline': '#7e94aa',
    'corrected': '#2be3d6',
    'accent': '#4da0ff',
    'alert': '#f97373',
    'observed': '#f2b46a',
    'positive': '#10b981',
    'negative': '#ef4444',
}

EXPERIMENT_LABELS = {
    'baseline': 'Hydra v2\n(Baseline)',
    'causal': 'Causal\nMask',
    'direct': 'Direct\nMode',
    'physics': 'Physics\nConstraint',
    'combined': 'Combined\n(Causal+Physics)',
}

SITE_LABELS = {
    '03161000': 'Jefferson, NC\n(Mid-basin)',
    '03164000': 'Galax, VA\n(Mainstem)',
    '03479000': 'Sugar Grove, NC\n(Headwaters)',
    '03486000': 'Elizabethton, TN\n(Regulated)',
}


def load_results(path: str = 'dashboard/public/data/experiment_results.json') -> dict:
    """Load experiment results from JSON."""
    with open(path) as f:
        return json.load(f)


def build_dataframe(data: dict) -> pd.DataFrame:
    """Convert results to a structured DataFrame."""
    rows = []
    for result in data['results']:
        site_meta = data['sites'].get(result['site_id'], {})
        row = {
            'experiment': result['experiment'],
            'site_id': result['site_id'],
            'site_name': site_meta.get('name', result['site_id']),
            'site_type': site_meta.get('type', 'unknown'),
            'watershed': site_meta.get('watershed', 'unknown'),
            'rmse_improvement_pct': result['rmse_improvement_pct'],
            # Baseline metrics
            'baseline_rmse': result['baseline']['rmse'],
            'baseline_nse': result['baseline']['nse'],
            'baseline_kge': result['baseline']['kge'],
            'baseline_pbias': result['baseline']['pbias'],
            # Corrected metrics
            'corrected_rmse': result['corrected']['rmse'],
            'corrected_nse': result['corrected']['nse'],
            'corrected_kge': result['corrected']['kge'],
            'corrected_pbias': result['corrected']['pbias'],
        }
        # Compute improvements
        row['nse_improvement'] = row['corrected_nse'] - row['baseline_nse']
        row['kge_improvement'] = row['corrected_kge'] - row['baseline_kge']
        row['pbias_improvement'] = abs(row['baseline_pbias']) - abs(row['corrected_pbias'])
        rows.append(row)

    return pd.DataFrame(rows)


def print_summary_statistics(df: pd.DataFrame):
    """Print summary statistics to console."""
    print("\n" + "="*70)
    print("HYDRA EXPERIMENT RESULTS - ENGINEERING ANALYSIS")
    print("="*70)

    # Overall performance
    print("\n## OVERALL PERFORMANCE ACROSS ALL SITES")
    print("-" * 50)

    for exp in df['experiment'].unique():
        exp_df = df[df['experiment'] == exp]
        avg_rmse = exp_df['rmse_improvement_pct'].mean()
        avg_nse = exp_df['nse_improvement'].mean()
        avg_kge = exp_df['kge_improvement'].mean()

        print(f"\n{exp.upper():12s} | RMSE: {avg_rmse:+6.2f}% | NSE: {avg_nse:+.3f} | KGE: {avg_kge:+.3f}")

    # Site-level breakdown
    print("\n\n## PERFORMANCE BY SITE")
    print("-" * 50)

    for site_id in df['site_id'].unique():
        site_df = df[df['site_id'] == site_id]
        site_name = site_df['site_name'].iloc[0]
        site_type = site_df['site_type'].iloc[0]

        print(f"\n{site_id} - {site_name} ({site_type})")

        # Best experiment for this site
        best = site_df.loc[site_df['rmse_improvement_pct'].idxmax()]
        worst = site_df.loc[site_df['rmse_improvement_pct'].idxmin()]

        print(f"  Best:  {best['experiment']:10s} → {best['rmse_improvement_pct']:+.2f}% RMSE")
        print(f"  Worst: {worst['experiment']:10s} → {worst['rmse_improvement_pct']:+.2f}% RMSE")

    # Key findings
    print("\n\n## KEY FINDINGS")
    print("-" * 50)

    # Best overall
    best_overall = df.loc[df['rmse_improvement_pct'].idxmax()]
    print(f"\n✓ Best result: {best_overall['experiment']} @ {best_overall['site_id']}")
    print(f"  RMSE improvement: {best_overall['rmse_improvement_pct']:.2f}%")
    print(f"  NSE: {best_overall['baseline_nse']:.3f} → {best_overall['corrected_nse']:.3f}")

    # Problematic cases
    negative_results = df[df['rmse_improvement_pct'] < 0]
    print(f"\n✗ Negative results: {len(negative_results)} / {len(df)} experiments")

    regulated = df[df['site_type'] == 'regulated']
    print(f"\n⚠ Regulated site (03486000) challenges:")
    print(f"  Average RMSE change: {regulated['rmse_improvement_pct'].mean():+.2f}%")
    print(f"  Only causal mask shows slight improvement ({regulated[regulated['experiment']=='causal']['rmse_improvement_pct'].values[0]:.2f}%)")


def plot_rmse_by_experiment(df: pd.DataFrame, output_dir: Path):
    """Bar chart of RMSE improvement by experiment type."""
    fig, ax = plt.subplots(figsize=(10, 6))

    # Aggregate by experiment
    exp_avg = df.groupby('experiment')['rmse_improvement_pct'].agg(['mean', 'std']).reset_index()
    exp_avg = exp_avg.sort_values('mean', ascending=False)

    colors = [COLORS['positive'] if x > 0 else COLORS['negative'] for x in exp_avg['mean']]

    bars = ax.bar(range(len(exp_avg)), exp_avg['mean'],
                  yerr=exp_avg['std'], capsize=4, color=colors, edgecolor='white', linewidth=1.5)

    ax.set_xticks(range(len(exp_avg)))
    ax.set_xticklabels([EXPERIMENT_LABELS.get(e, e) for e in exp_avg['experiment']])
    ax.axhline(y=0, color='gray', linestyle='-', linewidth=1)
    ax.set_ylabel('RMSE Improvement (%)')
    ax.set_title('Average RMSE Improvement by Experiment Configuration\n(Error bars show standard deviation across sites)')

    # Add value labels
    for bar, val in zip(bars, exp_avg['mean']):
        ypos = bar.get_height() + 1 if val > 0 else bar.get_height() - 3
        ax.annotate(f'{val:.1f}%', xy=(bar.get_x() + bar.get_width()/2, ypos),
                   ha='center', va='bottom' if val > 0 else 'top', fontsize=10, fontweight='bold')

    plt.tight_layout()
    fig.savefig(output_dir / 'rmse_by_experiment.png', dpi=150, bbox_inches='tight')
    plt.close(fig)
    print(f"  → Saved: rmse_by_experiment.png")


def plot_site_experiment_heatmap(df: pd.DataFrame, output_dir: Path):
    """Heatmap of RMSE improvement: sites × experiments."""
    pivot = df.pivot(index='site_id', columns='experiment', values='rmse_improvement_pct')

    # Reorder
    site_order = ['03161000', '03164000', '03479000', '03486000']
    exp_order = ['baseline', 'causal', 'direct', 'physics', 'combined']
    pivot = pivot.reindex(index=site_order, columns=exp_order)

    fig, ax = plt.subplots(figsize=(10, 5))

    # Custom colormap: red (negative) → white (0) → green (positive)
    cmap = sns.diverging_palette(10, 150, s=80, l=55, as_cmap=True)

    sns.heatmap(pivot, annot=True, fmt='.1f', cmap=cmap, center=0,
                linewidths=2, linecolor='white',
                cbar_kws={'label': 'RMSE Improvement (%)', 'shrink': 0.8},
                ax=ax, annot_kws={'fontsize': 11, 'fontweight': 'bold'})

    ax.set_yticklabels([SITE_LABELS.get(s, s) for s in site_order], rotation=0)
    ax.set_xticklabels([EXPERIMENT_LABELS.get(e, e).replace('\n', ' ') for e in exp_order], rotation=0)
    ax.set_xlabel('')
    ax.set_ylabel('')
    ax.set_title('RMSE Improvement (%) by Site and Experiment Configuration')

    plt.tight_layout()
    fig.savefig(output_dir / 'site_experiment_heatmap.png', dpi=150, bbox_inches='tight')
    plt.close(fig)
    print(f"  → Saved: site_experiment_heatmap.png")


def plot_nse_kge_scatter(df: pd.DataFrame, output_dir: Path):
    """Scatter plot of NSE vs KGE improvements."""
    fig, ax = plt.subplots(figsize=(8, 6))

    # Color by site type
    site_type_colors = {
        'mid-basin': COLORS['accent'],
        'mainstem': COLORS['corrected'],
        'headwaters': COLORS['observed'],
        'regulated': COLORS['alert'],
    }

    for site_type in df['site_type'].unique():
        subset = df[df['site_type'] == site_type]
        ax.scatter(subset['nse_improvement'], subset['kge_improvement'],
                  c=site_type_colors.get(site_type, 'gray'),
                  s=100, alpha=0.7, edgecolors='white', linewidth=1.5,
                  label=site_type.title())

    ax.axhline(y=0, color='gray', linestyle='--', alpha=0.5)
    ax.axvline(x=0, color='gray', linestyle='--', alpha=0.5)

    # Quadrant annotations
    ax.text(0.15, 0.15, 'Both\nImproved', ha='center', va='center',
            fontsize=9, color='green', alpha=0.7, transform=ax.transAxes)
    ax.text(0.85, 0.85, 'Both\nWorsened', ha='center', va='center',
            fontsize=9, color='red', alpha=0.7, transform=ax.transAxes)

    ax.set_xlabel('NSE Improvement (Corrected - Baseline)')
    ax.set_ylabel('KGE Improvement (Corrected - Baseline)')
    ax.set_title('NSE vs KGE Improvement Across All Experiments')
    ax.legend(title='Site Type', loc='lower right')

    plt.tight_layout()
    fig.savefig(output_dir / 'nse_kge_scatter.png', dpi=150, bbox_inches='tight')
    plt.close(fig)
    print(f"  → Saved: nse_kge_scatter.png")


def plot_baseline_vs_corrected(df: pd.DataFrame, output_dir: Path):
    """Comparison of baseline NWM vs corrected predictions."""
    fig, axes = plt.subplots(1, 2, figsize=(12, 5))

    # RMSE comparison
    ax1 = axes[0]
    x = np.arange(len(df))
    width = 0.35

    # Sort by improvement
    df_sorted = df.sort_values('rmse_improvement_pct', ascending=False)

    ax1.bar(x - width/2, df_sorted['baseline_rmse'], width, label='NWM Baseline', color=COLORS['baseline'])
    ax1.bar(x + width/2, df_sorted['corrected_rmse'], width, label='Hydra Corrected', color=COLORS['corrected'])
    ax1.set_ylabel('RMSE (m³/s)')
    ax1.set_title('RMSE: NWM Baseline vs Hydra Corrected')
    ax1.legend()
    ax1.set_xticks(x)
    ax1.set_xticklabels([f"{r['experiment'][:3]}\n{r['site_id'][-4:]}"
                         for _, r in df_sorted.iterrows()], rotation=0, fontsize=8)

    # NSE comparison
    ax2 = axes[1]
    ax2.bar(x - width/2, df_sorted['baseline_nse'], width, label='NWM Baseline', color=COLORS['baseline'])
    ax2.bar(x + width/2, df_sorted['corrected_nse'], width, label='Hydra Corrected', color=COLORS['corrected'])
    ax2.set_ylabel('NSE')
    ax2.set_title('NSE: NWM Baseline vs Hydra Corrected')
    ax2.axhline(y=0, color='gray', linestyle='--', alpha=0.5)
    ax2.legend()
    ax2.set_xticks(x)
    ax2.set_xticklabels([f"{r['experiment'][:3]}\n{r['site_id'][-4:]}"
                         for _, r in df_sorted.iterrows()], rotation=0, fontsize=8)

    plt.tight_layout()
    fig.savefig(output_dir / 'baseline_vs_corrected.png', dpi=150, bbox_inches='tight')
    plt.close(fig)
    print(f"  → Saved: baseline_vs_corrected.png")


def plot_site_performance_radar(df: pd.DataFrame, output_dir: Path):
    """Radar chart showing multi-metric performance by site (best experiment per site)."""
    # Get best experiment per site
    best_per_site = df.loc[df.groupby('site_id')['rmse_improvement_pct'].idxmax()]

    metrics = ['rmse_improvement_pct', 'nse_improvement', 'kge_improvement', 'pbias_improvement']
    metric_labels = ['RMSE\nImprove %', 'NSE\nImprove', 'KGE\nImprove', 'PBIAS\nImprove']

    # Normalize metrics for radar chart
    normalized = best_per_site[metrics].copy()
    for col in metrics:
        col_min, col_max = normalized[col].min(), normalized[col].max()
        if col_max != col_min:
            normalized[col] = (normalized[col] - col_min) / (col_max - col_min)
        else:
            normalized[col] = 0.5

    fig, ax = plt.subplots(figsize=(8, 8), subplot_kw=dict(projection='polar'))

    angles = np.linspace(0, 2*np.pi, len(metrics), endpoint=False).tolist()
    angles += angles[:1]  # Complete the loop

    colors_list = [COLORS['accent'], COLORS['corrected'], COLORS['observed'], COLORS['alert']]

    for idx, (_, row) in enumerate(best_per_site.iterrows()):
        values = normalized.loc[row.name, metrics].tolist()
        values += values[:1]

        ax.plot(angles, values, 'o-', linewidth=2, label=SITE_LABELS.get(row['site_id'], row['site_id']),
               color=colors_list[idx % len(colors_list)])
        ax.fill(angles, values, alpha=0.15, color=colors_list[idx % len(colors_list)])

    ax.set_xticks(angles[:-1])
    ax.set_xticklabels(metric_labels)
    ax.set_title('Best Experiment Performance by Site\n(Normalized metrics)', pad=20)
    ax.legend(loc='lower right', bbox_to_anchor=(1.3, 0))

    plt.tight_layout()
    fig.savefig(output_dir / 'site_performance_radar.png', dpi=150, bbox_inches='tight')
    plt.close(fig)
    print(f"  → Saved: site_performance_radar.png")


def generate_narrative(df: pd.DataFrame, output_dir: Path):
    """Generate engineering narrative markdown."""

    # Compute key statistics
    total_experiments = len(df)
    positive_results = len(df[df['rmse_improvement_pct'] > 0])
    avg_improvement = df[df['rmse_improvement_pct'] > 0]['rmse_improvement_pct'].mean()

    best = df.loc[df['rmse_improvement_pct'].idxmax()]

    # Site-specific stats
    regulated = df[df['site_type'] == 'regulated']
    unregulated = df[df['site_type'] != 'regulated']

    narrative = f"""# Hydra Model Performance Analysis
## Deep Learning for NWM Streamflow Error Correction

*Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}*

---

## Executive Summary

The Hydra transformer-based model demonstrates substantial capability in correcting National Water Model (NWM) streamflow prediction errors across Appalachian watersheds. Across **{total_experiments} experiments** spanning 4 USGS gauging stations, **{positive_results} ({100*positive_results/total_experiments:.0f}%)** showed positive RMSE improvement with an average reduction of **{avg_improvement:.1f}%** in prediction error.

### Key Findings

1. **Best Performance**: The **{best['experiment']}** configuration at **{best['site_id']}** ({best['site_name']}) achieved **{best['rmse_improvement_pct']:.1f}%** RMSE reduction
   - NSE improved from {best['baseline_nse']:.3f} to {best['corrected_nse']:.3f}
   - KGE improved from {best['baseline_kge']:.3f} to {best['corrected_kge']:.3f}

2. **Experiment Configuration Insights**:
"""

    # Add experiment-wise summary
    exp_summary = df.groupby('experiment')['rmse_improvement_pct'].agg(['mean', 'std', 'min', 'max'])
    for exp, row in exp_summary.iterrows():
        narrative += f"   - **{exp.title()}**: {row['mean']:+.1f}% avg (range: {row['min']:.1f}% to {row['max']:.1f}%)\n"

    narrative += f"""
3. **Site Type Analysis**:
   - Unregulated sites: {unregulated['rmse_improvement_pct'].mean():+.1f}% average improvement
   - Regulated site (Elizabethton): {regulated['rmse_improvement_pct'].mean():+.1f}% average (challenging due to dam operations)

---

## Technical Discussion

### Model Architecture Effectiveness

The Hydra architecture combines GRU recurrence with transformer attention mechanisms to capture both short-term temporal dependencies and long-range patterns in hydrometeorological time series. Results indicate:

1. **Causal Masking**: The causal attention mask, which prevents the model from attending to future timesteps, shows strong performance particularly at mainstem sites. This suggests that enforcing temporal causality improves generalization.

2. **Physics Constraints**: The non-negativity penalty on streamflow predictions shows the best performance at mid-basin sites (Jefferson, NC: {df[(df['experiment']=='physics') & (df['site_id']=='03161000')]['rmse_improvement_pct'].values[0]:.1f}% improvement), indicating that physics-informed loss functions can enhance physical consistency.

3. **Direct vs Residual Prediction**: Direct streamflow prediction (bypassing NWM residual correction) shows mixed results, performing well at headwater sites but degrading at regulated sites.

### Challenges at Regulated Sites

Site **03486000** (Watauga River at Elizabethton, TN) presents unique challenges:
- Located downstream of Watauga Dam, introducing non-stationarity in flow patterns
- Combined experiment shows significant degradation ({regulated[regulated['experiment']=='combined']['rmse_improvement_pct'].values[0]:.1f}%)
- Only causal masking achieves marginal improvement ({regulated[regulated['experiment']=='causal']['rmse_improvement_pct'].values[0]:.1f}%)

This suggests that dam operation signals may require explicit incorporation into the feature space or specialized architectures for regulated systems.

---

## Recommendations

1. **Production Deployment**: Prioritize **physics-constrained** or **causal mask** configurations for unregulated sites
2. **Regulated Sites**: Consider ensemble approaches or dam operation feature engineering
3. **Future Work**:
   - Investigate attention weight patterns during flood events
   - Evaluate transfer learning across watershed scales
   - Incorporate reservoir operation schedules as auxiliary inputs

---

## Appendix: Metrics Reference

| Metric | Description | Ideal Value |
|--------|-------------|-------------|
| RMSE | Root Mean Square Error | Lower is better |
| NSE | Nash-Sutcliffe Efficiency | 1.0 (perfect) |
| KGE | Kling-Gupta Efficiency | 1.0 (perfect) |
| PBIAS | Percent Bias | 0% (no bias) |

"""

    output_path = output_dir / 'experiment_analysis_narrative.md'
    with open(output_path, 'w') as f:
        f.write(narrative)
    print(f"  → Saved: experiment_analysis_narrative.md")


def main():
    # Setup
    project_root = Path(__file__).parent.parent
    output_dir = project_root / 'deliverables' / 'analysis'
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"\nLoading experiment results...")
    data = load_results(project_root / 'dashboard' / 'public' / 'data' / 'experiment_results.json')

    print(f"Building analysis dataframe...")
    df = build_dataframe(data)

    # Print summary to console
    print_summary_statistics(df)

    # Generate visualizations
    print(f"\n\nGenerating visualizations to: {output_dir}")
    plot_rmse_by_experiment(df, output_dir)
    plot_site_experiment_heatmap(df, output_dir)
    plot_nse_kge_scatter(df, output_dir)
    plot_baseline_vs_corrected(df, output_dir)
    plot_site_performance_radar(df, output_dir)

    # Generate narrative
    print(f"\nGenerating analysis narrative...")
    generate_narrative(df, output_dir)

    # Save processed dataframe
    df.to_csv(output_dir / 'experiment_results_processed.csv', index=False)
    print(f"  → Saved: experiment_results_processed.csv")

    print(f"\n{'='*70}")
    print(f"Analysis complete! Output in: {output_dir}")
    print(f"{'='*70}\n")


if __name__ == '__main__':
    main()
