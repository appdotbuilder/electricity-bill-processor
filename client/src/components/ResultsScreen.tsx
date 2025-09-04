import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { trpc } from '@/utils/trpc';
import { BillsChart } from '@/components/BillsChart';
import type { UploadStatusResponse, ElectricityBill } from '../../../server/src/schema';

// User interface
interface User {
  id: number;
  name: string;
  email: string;
}

interface ResultsScreenProps {
  uploadId: number;
  user?: User;
  onBackToUpload: () => void;
}

export function ResultsScreen({ uploadId, onBackToUpload }: ResultsScreenProps) {
  const [uploadStatus, setUploadStatus] = useState<UploadStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [refreshCount, setRefreshCount] = useState(0);

  const loadUploadStatus = useCallback(async () => {
    try {
      setError(null);
      const status = await trpc.getUploadStatus.query({ upload_id: uploadId });
      setUploadStatus(status);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar status do upload');
    } finally {
      setIsLoading(false);
    }
  }, [uploadId]);

  useEffect(() => {
    loadUploadStatus();
  }, [loadUploadStatus]);

  // Auto-refresh while processing
  useEffect(() => {
    if (uploadStatus?.upload.status === 'processing' && refreshCount < 20) {
      const timer = setTimeout(() => {
        setRefreshCount(prev => prev + 1);
        loadUploadStatus();
      }, 3000); // Refresh every 3 seconds

      return () => clearTimeout(timer);
    }
  }, [uploadStatus?.upload.status, refreshCount, loadUploadStatus]);

  const handleGenerateReport = async (format: 'excel' | 'csv') => {
    setIsGeneratingReport(true);
    try {
      // Generate and download the report file
      await trpc.generateReport.query({
        upload_id: uploadId,
        format: format
      });
      
      // In production, this would trigger a file download
      alert(`Relatório ${format.toUpperCase()} gerado com sucesso! Download iniciado.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao gerar relatório');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('pt-BR').format(new Date(date));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-100 text-green-800">Processado</Badge>;
      case 'error':
        return <Badge className="bg-red-100 text-red-800">Erro</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">Pendente</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p>Carregando resultados...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !uploadStatus) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Alert className="border-red-200 bg-red-50">
          <AlertDescription className="text-red-700">
            {error || 'Não foi possível carregar os dados do upload'}
          </AlertDescription>
        </Alert>
        <Button onClick={onBackToUpload} variant="outline">
          ← Voltar para Upload
        </Button>
      </div>
    );
  }

  const { upload, bills } = uploadStatus;
  const successfulBills = bills.filter(bill => bill.extraction_status === 'success');
  const failedBills = bills.filter(bill => bill.extraction_status === 'error');
  const processingProgress = upload.total_files > 0 ? (upload.processed_files / upload.total_files) * 100 : 0;

  // Calculate totals for successful bills
  const totalOriginal = successfulBills.reduce((sum, bill) => sum + bill.total_amount, 0);
  const totalCorrected = successfulBills.reduce((sum, bill) => sum + (bill.corrected_amount || 0), 0);
  const totalConsumption = successfulBills.reduce((sum, bill) => sum + bill.energy_consumption, 0);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-800">📊 Resultados do Processamento</h2>
          <p className="text-gray-600 mt-1">
            Upload: {upload.filename} • {formatDate(upload.created_at)}
          </p>
        </div>
        <Button onClick={onBackToUpload} variant="outline">
          ← Novo Upload
        </Button>
      </div>

      {/* Processing Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Status do Processamento
            <Badge 
              className={
                upload.status === 'completed' ? 'bg-green-100 text-green-800' :
                upload.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                'bg-red-100 text-red-800'
              }
            >
              {upload.status === 'completed' ? 'Concluído' :
               upload.status === 'processing' ? 'Processando' : 'Erro'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between text-sm">
              <span>Progresso: {upload.processed_files} de {upload.total_files} arquivos</span>
              <span>{Math.round(processingProgress)}%</span>
            </div>
            <Progress value={processingProgress} className="w-full" />
            
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {upload.processed_files - upload.failed_files}
                </div>
                <div className="text-sm text-green-600">Processados</div>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{upload.failed_files}</div>
                <div className="text-sm text-red-600">Com Erro</div>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{upload.total_files}</div>
                <div className="text-sm text-blue-600">Total</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {successfulBills.length > 0 && (
        <div className="grid md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-gray-800">{successfulBills.length}</div>
              <div className="text-sm text-gray-600">Contas Processadas</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-blue-600">{formatCurrency(totalOriginal)}</div>
              <div className="text-sm text-gray-600">Total Original</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-green-600">{formatCurrency(totalCorrected)}</div>
              <div className="text-sm text-gray-600">Total Corrigido (SELIC)</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-purple-600">
                {totalConsumption.toLocaleString('pt-BR')} kWh
              </div>
              <div className="text-sm text-gray-600">Consumo Total</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="details">Detalhes</TabsTrigger>
          <TabsTrigger value="chart">Gráfico</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {successfulBills.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>💰 Resumo Financeiro</CardTitle>
                <CardDescription>
                  Comparação entre valores originais e corrigidos pela SELIC
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-4 bg-blue-50 rounded-lg">
                    <div>
                      <div className="font-medium text-blue-900">Total Original</div>
                      <div className="text-sm text-blue-600">Soma de todas as contas processadas</div>
                    </div>
                    <div className="text-2xl font-bold text-blue-600">
                      {formatCurrency(totalOriginal)}
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center p-4 bg-green-50 rounded-lg">
                    <div>
                      <div className="font-medium text-green-900">Total Corrigido (SELIC)</div>
                      <div className="text-sm text-green-600">Valores atualizados pela taxa SELIC</div>
                    </div>
                    <div className="text-2xl font-bold text-green-600">
                      {formatCurrency(totalCorrected)}
                    </div>
                  </div>

                  <div className="flex justify-between items-center p-4 bg-purple-50 rounded-lg">
                    <div>
                      <div className="font-medium text-purple-900">Diferença (Correção)</div>
                      <div className="text-sm text-purple-600">Valor adicional devido à correção monetária</div>
                    </div>
                    <div className="text-2xl font-bold text-purple-600">
                      {formatCurrency(totalCorrected - totalOriginal)}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Report Generation */}
          <Card>
            <CardHeader>
              <CardTitle>📄 Gerar Relatório</CardTitle>
              <CardDescription>
                Baixe um relatório completo com todos os dados processados
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                <Button
                  onClick={() => handleGenerateReport('excel')}
                  disabled={isGeneratingReport}
                  className="bg-green-600 hover:bg-green-700"
                >
                  📊 Baixar Excel
                </Button>
                <Button
                  onClick={() => handleGenerateReport('csv')}
                  disabled={isGeneratingReport}
                  variant="outline"
                >
                  📋 Baixar CSV
                </Button>
              </div>
              {isGeneratingReport && (
                <p className="text-sm text-gray-500 mt-2">Gerando relatório...</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="details">
          <Card>
            <CardHeader>
              <CardTitle>📋 Detalhes das Contas</CardTitle>
              <CardDescription>
                Informações detalhadas de cada conta processada
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Arquivo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data da Conta</TableHead>
                    <TableHead>Valor Original</TableHead>
                    <TableHead>Valor Corrigido</TableHead>
                    <TableHead>Consumo (kWh)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bills.map((bill: ElectricityBill) => (
                    <TableRow key={bill.id}>
                      <TableCell className="font-medium">{bill.filename}</TableCell>
                      <TableCell>{getStatusBadge(bill.extraction_status)}</TableCell>
                      <TableCell>
                        {bill.extraction_status === 'success' ? formatDate(bill.bill_date) : '-'}
                      </TableCell>
                      <TableCell>
                        {bill.extraction_status === 'success' ? formatCurrency(bill.total_amount) : '-'}
                      </TableCell>
                      <TableCell>
                        {bill.extraction_status === 'success' && bill.corrected_amount 
                          ? formatCurrency(bill.corrected_amount) : '-'}
                      </TableCell>
                      <TableCell>
                        {bill.extraction_status === 'success' 
                          ? `${bill.energy_consumption.toLocaleString('pt-BR')} kWh` : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {failedBills.length > 0 && (
                <div className="mt-4">
                  <Alert className="border-yellow-200 bg-yellow-50">
                    <AlertDescription className="text-yellow-700">
                      <strong>Arquivos não processados:</strong> {failedBills.length} arquivo(s) apresentaram erro durante o processamento. 
                      Verifique se os arquivos estão no formato correto (PDF legível ou imagem clara).
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="chart">
          {successfulBills.length > 0 ? (
            <BillsChart bills={successfulBills} />
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center py-8">
                <div className="text-center text-gray-500">
                  <div className="text-4xl mb-2">📊</div>
                  <p>Nenhuma conta foi processada com sucesso para exibir gráficos.</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}