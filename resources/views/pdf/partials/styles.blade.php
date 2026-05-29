<style>
    @page {
        margin: 30px 34px 44px;
    }

    * {
        box-sizing: border-box;
    }

    body {
        margin: 0;
        color: #1a1a1a;
        font-family: "DejaVu Sans", sans-serif;
        font-size: 11px;
        line-height: 1.45;
        background: #ffffff;
    }

    .brand-bar {
        border-bottom: 2px solid #720101;
        padding-bottom: 14px;
        margin-bottom: 18px;
    }

    .brand-kicker {
        color: #a16207;
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 2px;
        text-transform: uppercase;
    }

    .brand-title {
        margin: 4px 0 0;
        color: #1a1a1a;
        font-size: 22px;
        font-weight: 800;
        line-height: 1.1;
    }

    .brand-meta {
        margin-top: 6px;
        color: #64748b;
        font-size: 10px;
        font-weight: 700;
    }

    .grid {
        display: table;
        width: 100%;
        table-layout: fixed;
    }

    .grid-row {
        display: table-row;
    }

    .grid-cell {
        display: table-cell;
        vertical-align: top;
        padding-right: 10px;
    }

    .grid-cell:last-child {
        padding-right: 0;
    }

    .section {
        margin-top: 16px;
        page-break-inside: avoid;
    }

    .section-title {
        margin: 0 0 8px;
        color: #1a1a1a;
        font-size: 13px;
        font-weight: 800;
    }

    .eyebrow {
        margin: 0 0 4px;
        color: #94a3b8;
        font-size: 8px;
        font-weight: 800;
        letter-spacing: 1.5px;
        text-transform: uppercase;
    }

    .box {
        border: 1px solid #eadfd8;
        background: #fffaf3;
        padding: 10px 12px;
        page-break-inside: avoid;
    }

    .flat-table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
    }

    .flat-table th {
        border-bottom: 1px solid #eadfd8;
        color: #64748b;
        font-size: 8px;
        font-weight: 800;
        letter-spacing: 1px;
        padding: 7px 8px;
        text-align: left;
        text-transform: uppercase;
    }

    .flat-table td {
        border-bottom: 1px solid #f1e7df;
        padding: 8px;
        vertical-align: top;
        word-break: break-word;
    }

    .value {
        color: #0f172a;
        font-size: 14px;
        font-weight: 800;
    }

    .muted {
        color: #64748b;
        font-weight: 700;
    }

    .note {
        border-left: 3px solid #d99a00;
        background: #fff8df;
        color: #713f12;
        margin-top: 12px;
        padding: 9px 11px;
        font-weight: 700;
        page-break-inside: avoid;
    }

    .danger-note {
        border-left-color: #9b111e;
        background: #fff1f2;
        color: #7f1d1d;
    }

    .pill {
        display: inline-block;
        border: 1px solid #eadfd8;
        background: #ffffff;
        border-radius: 999px;
        color: #720101;
        font-size: 8px;
        font-weight: 800;
        letter-spacing: .8px;
        padding: 2px 7px;
        text-transform: uppercase;
    }

    .ready {
        border-color: #bbf7d0;
        background: #f0fdf4;
        color: #166534;
    }

    .needs-check {
        border-color: #fde68a;
        background: #fffbeb;
        color: #92400e;
    }

    .footer-note {
        margin-top: 18px;
        color: #64748b;
        font-size: 9px;
        font-weight: 700;
    }

    .avoid-break {
        page-break-inside: avoid;
    }
</style>
