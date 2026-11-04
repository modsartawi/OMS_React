// Ticket 757 item 4: DispatchScorecardMath.Percentile, copied VERBATIM from
// C:\Work\DMSCO\BackOffice\Sartawi.Retail.Data\Modules\Callouts\Scorecard\DispatchScorecardMath.cs (lines 530-541),
// run over the same samples SQL Server's PERCENTILE_CONT answered (sql/09-inc-sample.sql).
// Usage: dotnet run -- <file of "group|value" lines>   prints group|n|p50|p90
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;

static class DispatchScorecardMath
{
    /// <summary>The exact <paramref name="p"/>-th percentile, interpolated between the two closest ranks
    /// (Excel's PERCENTILE.INC), so p = 0.5 is the ordinary median. Null for no values.</summary>
    public static double? Percentile(IEnumerable<double> values, double p)
    {
        var sorted = (values ?? Enumerable.Empty<double>()).OrderBy(v => v).ToList();
        if (sorted.Count == 0)
            return null;
        var h = (sorted.Count - 1) * p;
        var lo = (int)Math.Floor(h);
        var hi = Math.Min(lo + 1, sorted.Count - 1);
        return sorted[lo] + (h - lo) * (sorted[hi] - sorted[lo]);
    }
}

static class Program
{
    static void Main(string[] args)
    {
        var rows = File.ReadAllLines(args[0])
            .Where(l => l.Contains('|'))
            .Select(l => l.Split('|'))
            .Where(p => double.TryParse(p[1], NumberStyles.Float, CultureInfo.InvariantCulture, out _))
            .Select(p => (Group: p[0].Trim(), Value: double.Parse(p[1], CultureInfo.InvariantCulture)));
        foreach (var g in rows.GroupBy(r => r.Group).OrderBy(g => g.Key, StringComparer.Ordinal))
        {
            var v = g.Select(r => r.Value).ToList();
            Console.WriteLine(string.Join("|", g.Key, v.Count,
                DispatchScorecardMath.Percentile(v, 0.5)?.ToString("G17", CultureInfo.InvariantCulture),
                DispatchScorecardMath.Percentile(v, 0.9)?.ToString("G17", CultureInfo.InvariantCulture)));
        }
    }
}
