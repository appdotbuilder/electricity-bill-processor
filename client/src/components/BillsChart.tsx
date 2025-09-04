import React, { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ElectricityBill } from '../../../server/src/schema';

interface BillsChartProps {
  bills: ElectricityBill[];
}

// Simple chart implementation using CSS and HTML (since we don't have chart libraries installed)
export function BillsChart({ bills }: BillsChartProps) {
  const chartData = useMemo(() => {
    // Group bills by year and calculate totals
    const yearlyData = bills.reduce((acc, bill) => {
      const year = new Date(bill.bill_date).getFullYear();
      if (!acc[year]) {
        acc[year] = {
          year,
          originalTotal: 0,
          correctedTotal: 0,
          consumption: 0,
          count: 0
        };
      }
      acc[year].originalTotal += bill.total_amount;
      acc[year].correctedTotal += bill.corrected_amount || 0;
      acc[year].consumption += bill.energy_consumption;
      acc[year].count += 1;
      return acc;
    }, {} as Record<number, {
      year: number;
      originalTotal: number;
      correctedTotal: number;
      consumption: number;
      count: number;
    }>);

    const sortedData = Object.values(yearlyData).sort((a, b) => a.year - b.year);
    
    // Calculate max values for scaling
    const maxOriginal = Math.max(...sortedData.map(d => d.originalTotal));
    const maxCorrected = Math.max(...sortedData.map(d => d.correctedTotal));
    const maxValue = Math.max(maxOriginal, maxCorrected);

    return sortedData.map(data => ({
      ...data,
      originalPercentage: (data.originalTotal / maxValue) * 100,
      correctedPercentage: (data.correctedTotal / maxValue) * 100
    }));
  }, [bills]);

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const monthlyData = useMemo(() => {
    // Group bills by month/year for monthly chart
    const monthlyMap = bills.reduce((acc, bill) => {
      const date = new Date(bill.bill_date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const displayDate = date.toLocaleDateString('pt-BR', { year: 'numeric', month: 'short' });
      
      if (!acc[key]) {
        acc[key] = {
          date: displayDate,
          sortDate: date,
          originalTotal: 0,
          correctedTotal: 0,
          consumption: 0,
          count: 0
        };
      }
      acc[key].originalTotal += bill.total_amount;
      acc[key].correctedTotal += bill.corrected_amount || 0;
      acc[key].consumption += bill.energy_consumption;
      acc[key].count += 1;
      return acc;
    }, {} as Record<string, {
      date: string;
      sortDate: Date;
      originalTotal: number;
      correctedTotal: number;
      consumption: number;
      count: number;
    }>);

    const sortedMonthly = Object.values(monthlyMap)
      .sort((a, b) => a.sortDate.getTime() - b.sortDate.getTime())
      .slice(-12); // Show last 12 months

    const maxMonthlyValue = Math.max(
      ...sortedMonthly.map(d => Math.max(d.originalTotal, d.correctedTotal))
    );

    return sortedMonthly.map(data => ({
      ...data,
      originalPercentage: (data.originalTotal / maxMonthlyValue) * 100,
      correctedPercentage: (data.correctedTotal / maxMonthlyValue) * 100
    }));
  }, [bills]);

  return (
    <div className="space-y-6">
      {/* Yearly Summary Chart */}
      <Card>
        <CardHeader>
          <CardTitle>📈 Evolução Anual dos Valores</CardTitle>
          <CardDescription>
            Comparação entre valores originais e corrigidos por ano
          </CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Não há dados suficientes para gerar o gráfico anual
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-blue-500 rounded"></div>
                  <span>Valor Original</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-500 rounded"></div>
                  <span>Valor Corrigido (SELIC)</span>
                </div>
              </div>
              
              <div className="space-y-3">
                {chartData.map((data) => (
                  <div key={data.year} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-gray-700">{data.year}</span>
                      <span className="text-sm text-gray-500">
                        {data.count} conta{data.count !== 1 ? 's' : ''}
                      </span>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <div className="w-24 text-sm text-blue-600">
                          {formatCurrency(data.originalTotal)}
                        </div>
                        <div className="flex-1 bg-gray-200 rounded-full h-6 relative">
                          <div 
                            className="bg-blue-500 h-6 rounded-full flex items-center justify-end pr-2"
                            style={{ width: `${data.originalPercentage}%` }}
                          >
                            {data.originalPercentage > 15 && (
                              <span className="text-white text-xs font-medium">
                                Original
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="w-24 text-sm text-green-600">
                          {formatCurrency(data.correctedTotal)}
                        </div>
                        <div className="flex-1 bg-gray-200 rounded-full h-6 relative">
                          <div 
                            className="bg-green-500 h-6 rounded-full flex items-center justify-end pr-2"
                            style={{ width: `${data.correctedPercentage}%` }}
                          >
                            {data.correctedPercentage > 15 && (
                              <span className="text-white text-xs font-medium">
                                Corrigido
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Monthly Chart */}
      {monthlyData.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>📊 Evolução Mensal (Últimos 12 meses)</CardTitle>
            <CardDescription>
              Valores mensais das contas processadas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-blue-400 rounded"></div>
                  <span>Valor Original</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-400 rounded"></div>
                  <span>Valor Corrigido (SELIC)</span>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {monthlyData.map((data, index) => (
                  <div key={index} className="p-3 border rounded-lg hover:bg-gray-50">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-gray-700">{data.date}</span>
                      <span className="text-xs text-gray-500">
                        {data.count} conta{data.count !== 1 ? 's' : ''}
                      </span>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-blue-600">Original:</span>
                        <span className="font-medium text-blue-600">
                          {formatCurrency(data.originalTotal)}
                        </span>
                      </div>
                      
                      <div className="flex justify-between text-sm">
                        <span className="text-green-600">Corrigido:</span>
                        <span className="font-medium text-green-600">
                          {formatCurrency(data.correctedTotal)}
                        </span>
                      </div>
                      
                      <div className="flex justify-between text-sm">
                        <span className="text-purple-600">Diferença:</span>
                        <span className="font-medium text-purple-600">
                          {formatCurrency(data.correctedTotal - data.originalTotal)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Consumption Chart */}
      <Card>
        <CardHeader>
          <CardTitle>⚡ Consumo de Energia por Ano</CardTitle>
          <CardDescription>
            Total de energia consumida (kWh) por ano
          </CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Não há dados de consumo para exibir
            </div>
          ) : (
            <div className="space-y-3">
              {chartData.map((data) => {
                const maxConsumption = Math.max(...chartData.map(d => d.consumption));
                const consumptionPercentage = (data.consumption / maxConsumption) * 100;
                
                return (
                  <div key={data.year} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-gray-700">{data.year}</span>
                      <span className="text-sm font-medium text-purple-600">
                        {data.consumption.toLocaleString('pt-BR')} kWh
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-gray-200 rounded-full h-6 relative">
                        <div 
                          className="bg-purple-500 h-6 rounded-full flex items-center justify-center"
                          style={{ width: `${consumptionPercentage}%` }}
                        >
                          {consumptionPercentage > 20 && (
                            <span className="text-white text-xs font-medium">
                              {data.consumption.toLocaleString('pt-BR')} kWh
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}