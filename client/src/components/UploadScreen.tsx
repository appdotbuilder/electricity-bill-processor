import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { trpc } from '@/utils/trpc';
import type { UploadResponse } from '../../../server/src/schema';

// User interface
interface User {
  id: number;
  name: string;
  email: string;
}

interface UploadScreenProps {
  user?: User;
  onUploadComplete: (uploadId: number) => void;
}

export function UploadScreen({ onUploadComplete }: UploadScreenProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File) => {
    setError(null);
    setSuccess(null);

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setError('Por favor, selecione apenas arquivos ZIP.');
      return;
    }

    // Validate file size (max 50MB for demo)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      setError('O arquivo é muito grande. Tamanho máximo permitido: 50MB.');
      return;
    }

    setSelectedFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 80));
      }, 200);

      // Call the tRPC endpoint
      const response: UploadResponse = await trpc.uploadZip.mutate({
        filename: selectedFile.name,
        file_size: selectedFile.size,
        file_count: 10 // Estimated - in real implementation, this would be extracted from ZIP
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      setSuccess(`Upload realizado com sucesso! ${response.message}`);
      
      // Navigate to results after a short delay
      setTimeout(() => {
        onUploadComplete(response.upload_id);
      }, 1500);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao fazer upload do arquivo');
      setUploadProgress(0);
    } finally {
      setIsUploading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">
          📁 Upload de Contas de Energia
        </h2>
        <p className="text-gray-600">
          Envie um arquivo ZIP contendo suas contas de energia elétrica em PDF ou imagem
        </p>
      </div>

      {/* Instructions Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            ℹ️ Como funciona
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-blue-600 font-bold">1</span>
              </div>
              <div>
                <h4 className="font-medium mb-1">Prepare seus arquivos</h4>
                <p className="text-gray-600">
                  Coloque todas as contas de energia (PDF ou imagem) em um arquivo ZIP
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-green-600 font-bold">2</span>
              </div>
              <div>
                <h4 className="font-medium mb-1">Upload e processamento</h4>
                <p className="text-gray-600">
                  O sistema extrai automaticamente os valores e calcula a correção SELIC
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-purple-600 font-bold">3</span>
              </div>
              <div>
                <h4 className="font-medium mb-1">Relatório final</h4>
                <p className="text-gray-600">
                  Visualize os resultados e baixe o relatório em Excel ou CSV
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upload Card */}
      <Card>
        <CardHeader>
          <CardTitle>Upload do arquivo ZIP</CardTitle>
          <CardDescription>
            Selecione ou arraste um arquivo ZIP contendo suas contas de energia
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert className="mb-4 border-red-200 bg-red-50">
              <AlertDescription className="text-red-700">{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="mb-4 border-green-200 bg-green-50">
              <AlertDescription className="text-green-700">{success}</AlertDescription>
            </Alert>
          )}

          {/* File Drop Zone */}
          <div
            className={`
              border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
              ${isDragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
              ${selectedFile ? 'border-green-400 bg-green-50' : ''}
            `}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip"
              onChange={handleFileInputChange}
              className="hidden"
            />

            {!selectedFile ? (
              <div className="space-y-3">
                <div className="text-4xl">📁</div>
                <div>
                  <p className="text-lg font-medium text-gray-700">
                    Clique aqui ou arraste seu arquivo ZIP
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    Apenas arquivos ZIP são aceitos (máx. 50MB)
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-4xl">✅</div>
                <div>
                  <p className="text-lg font-medium text-green-700">
                    {selectedFile.name}
                  </p>
                  <p className="text-sm text-gray-500">
                    {formatFileSize(selectedFile.size)}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Upload Progress */}
          {isUploading && (
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Processando arquivo...</span>
                <span>{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="w-full" />
            </div>
          )}

          {/* Upload Button */}
          {selectedFile && !isUploading && !success && (
            <div className="mt-4 flex justify-center">
              <Button
                onClick={handleUpload}
                className="px-8 py-2 bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600"
                disabled={isUploading}
              >
                🚀 Processar Contas de Energia
              </Button>
            </div>
          )}

          {/* File Requirements */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-gray-800 mb-2">📋 Requisitos do arquivo</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Formato: Arquivo ZIP</li>
              <li>• Conteúdo: Contas de energia em PDF ou imagem (JPG, PNG)</li>
              <li>• Tamanho máximo: 50MB</li>
              <li>• O sistema extrai automaticamente: "Total a pagar" e "Consumo de energia em kWh"</li>
              <li>• Aplica correção monetária baseada na taxa SELIC histórica</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}