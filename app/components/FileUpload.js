'use client';

import { useState } from 'react';
import { supabase } from '../../utils/supabase/client';

export default function FileUpload({ userRole, userAlianza, onUploadSuccess, tableType = 'auto' }) {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedTable, setSelectedTable] = useState(tableType);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadHistory, setUploadHistory] = useState([
    // Mock data for demonstration
    {
      id: 1,
      filename: 'siniestros_enero_2024.csv',
      uploadDate: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      records: 45,
      status: 'Procesado',
      tableType: 'auto',
      alianza: 'ALIANZA 1'
    },
    {
      id: 2,
      filename: 'renovaciones_diciembre.csv',
      uploadDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      records: 23,
      status: 'Procesado',
      tableType: 'renovaciones',
      alianza: 'ALIANZA 2'
    },
    {
      id: 3,
      filename: 'validaciones_noviembre.csv',
      uploadDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      records: 78,
      status: 'Procesado',
      tableType: 'validaciones',
      alianza: 'ADMIN'
    },
    {
      id: 4,
      filename: 'accidentes_noviembre.csv',
      uploadDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      records: 12,
      status: 'Procesado',
      tableType: 'auto',
      alianza: 'ALIANZA 1'
    }
  ]);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files);
    }
  };

  const parseCSVPreview = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target.result;
          const lines = text.split('\n').filter(line => line.trim() !== '');
          
          if (lines.length === 0) {
            reject(new Error('El archivo está vacío'));
            return;
          }

          // Parse headers
          const headers = lines[0].split(',').map(header => header.trim().replace(/"/g, ''));
          
          // Parse first 5 rows for preview
          const previewRows = lines.slice(1, Math.min(6, lines.length)).map(line => {
            const values = line.split(',').map(value => value.trim().replace(/"/g, ''));
            const row = {};
            headers.forEach((header, index) => {
              row[header] = values[index] || '';
            });
            return row;
          });

          resolve({
            headers,
            rows: previewRows,
            totalRows: lines.length - 1, // Subtract header row
            filename: file.name,
            fileSize: file.size
          });
        } catch (error) {
          reject(new Error('Error al leer el archivo CSV: ' + error.message));
        }
      };
      reader.onerror = () => reject(new Error('Error al leer el archivo'));
      reader.readAsText(file);
    });
  };

  const handleFiles = async (files) => {
    const file = files[0];
    
    // Validate file type (only CSV for now, as per API route)
    if (!file.name.toLowerCase().endsWith('.csv')) {
      alert('Por favor selecciona un archivo CSV');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('El archivo es demasiado grande. Máximo 10MB permitido.');
      return;
    }

    try {
      // Parse CSV for preview
      const preview = await parseCSVPreview(file);
      setPreviewData(preview);
      setSelectedFile(file);
      setShowPreview(true);
    } catch (error) {
      alert('Error al procesar el archivo: ' + error.message);
    }
  };

  const confirmUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setShowPreview(false);

    try {
      // Get current user for email
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('Usuario no autenticado');
      }

      // Create FormData for the API request
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('userEmail', user.email);
      formData.append('userRole', userRole);
      formData.append('tableType', selectedTable);

      // Upload file using appropriate API route based on table type
      let apiEndpoint = '/api/upload'; // Default for 'auto'
      if (selectedTable === 'renovaciones') {
        apiEndpoint = '/api/upload-renovaciones';
      } else if (selectedTable === 'validaciones') {
        apiEndpoint = '/api/upload-validaciones';
      }
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al subir el archivo');
      }

      // Add to upload history
      const newUpload = {
        id: Date.now(),
        filename: selectedFile.name,
        uploadDate: new Date(),
        records: result.recordsProcessed,
        status: 'Procesado',
        tableType: selectedTable,
        alianza: userAlianza ? userAlianza.toUpperCase().replace('ALIANZA', 'ALIANZA ') : 'ADMIN'
      };

      setUploadHistory(prev => [newUpload, ...prev]);

      // Notify parent component
      if (onUploadSuccess) {
        onUploadSuccess(newUpload);
      }

      const tableTypeText = selectedTable === 'auto' ? 'seguros de auto' : 
                           selectedTable === 'renovaciones' ? 'renovaciones' : 'validaciones';
      alert(`Archivo subido y procesado exitosamente en ${tableTypeText}. ${result.recordsProcessed} registros procesados.`);

    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Error al subir el archivo: ' + error.message);
    } finally {
      setUploading(false);
      setSelectedFile(null);
      setPreviewData(null);
    }
  };

  const cancelPreview = () => {
    setShowPreview(false);
    setSelectedFile(null);
    setPreviewData(null);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (date) => {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 60) {
      return `Hace ${minutes} minutos`;
    } else if (hours < 24) {
      return `Hace ${hours} horas`;
    } else {
      return `Hace ${days} días`;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Procesado':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'Procesando':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Error':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Filter upload history based on user role
  const filteredHistory = userRole === 'admin' 
    ? uploadHistory 
    : uploadHistory.filter(upload => 
        upload.alianza === (userAlianza ? userAlianza.toUpperCase().replace('ALIANZA', 'ALIANZA ') : '')
      );

  return (
    <div className="space-y-6">
      {/* File Upload Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Cargar Archivo CSV</h3>
          <div className="text-sm text-gray-500">
            {userRole === 'admin' ? 'Administrador' : userAlianza?.toUpperCase()}
          </div>
        </div>
        
        {/* Table Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Datos</label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                name="tableType"
                value="auto"
                checked={selectedTable === 'auto'}
                onChange={(e) => setSelectedTable(e.target.value)}
                className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300"
              />
              <span className="ml-2 text-sm text-gray-700">Datos de Seguros Auto</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="tableType"
                value="renovaciones"
                checked={selectedTable === 'renovaciones'}
                onChange={(e) => setSelectedTable(e.target.value)}
                className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300"
              />
              <span className="ml-2 text-sm text-gray-700">Datos de Renovaciones</span>
            </label>
            {/* <label className="flex items-center">
              <input
                type="radio"
                name="tableType"
                value="validaciones"
                checked={selectedTable === 'validaciones'}
                onChange={(e) => setSelectedTable(e.target.value)}
                className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300"
              />
              <span className="ml-2 text-sm text-gray-700">Datos de Validaciones</span>
            </label> */}
          </div>
        </div>
        
        <p className="text-sm text-gray-600 mb-4">
          {selectedTable === 'auto' ? 
            'Sube archivos CSV con datos de seguros de auto' : 
            selectedTable === 'renovaciones' ?
            'Sube archivos CSV con datos de renovaciones de pólizas' :
            'Sube archivos CSV con datos de validaciones'
          }
        </p>

        {/* Upload Area */}
        <div
          className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive 
              ? 'border-red-400 bg-red-50' 
              : 'border-gray-300 hover:border-gray-400'
          } ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          {uploading ? (
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mb-4"></div>
              <p className="text-sm text-gray-600">Procesando archivo...</p>
            </div>
          ) : (
            <>
              <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div className="text-sm text-gray-600">
                <p className="font-medium">Arrastra tu archivo aquí</p>
                <p>o haz clic para seleccionar</p>
              </div>
              <input
                type="file"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                accept=".csv"
                onChange={handleChange}
                disabled={uploading}
              />
              <button
                type="button"
                className="mt-4 inline-flex items-center px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                onClick={() => document.querySelector('input[type="file"]').click()}
                disabled={uploading}
              >
                Seleccionar Archivo
              </button>
            </>
          )}
        </div>

        <div className="mt-4 text-xs text-gray-500">
          <p>Formatos aceptados: .csv</p>
          <p>Tamaño máximo: 10MB</p>
        </div>
      </div>

      {/* Upload History */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Historial de Cargas</h3>
          <p className="text-sm text-gray-600">Últimos archivos procesados</p>
        </div>
        
        <div className="p-6">
          {filteredHistory.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p>No hay archivos subidos aún</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredHistory.map((upload) => (
                <div key={upload.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      <svg className="h-8 w-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">{upload.filename}</h4>
                      <p className="text-xs text-gray-500">
                        {formatDate(upload.uploadDate)} - {upload.records} registros
                        <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                          {upload.tableType === 'auto' ? 'Seguros Auto' : 
                           upload.tableType === 'renovaciones' ? 'Renovaciones' : 'Validaciones'}
                        </span>
                        {userRole === 'admin' && (
                          <span className="ml-2 text-blue-600">({upload.alianza})</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getStatusBadge(upload.status)}`}>
                      {upload.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && previewData && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-6xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-gray-200">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Vista Previa del Archivo</h3>
                  <p className="text-sm text-gray-600">
                    Revisa los datos antes de subirlos a la tabla: <span className="font-medium">{selectedTable}</span>
                  </p>
                </div>
                <button
                  onClick={cancelPreview}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* File Info */}
              <div className="py-4 border-b border-gray-200">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Archivo:</span>
                    <p className="font-medium text-gray-900">{previewData.filename}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Tamaño:</span>
                    <p className="font-medium text-gray-900">{formatFileSize(previewData.fileSize)}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Total de registros:</span>
                    <p className="font-medium text-gray-900">{previewData.totalRows}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Columnas:</span>
                    <p className="font-medium text-gray-900">{previewData.headers.length}</p>
                  </div>
                </div>
              </div>

              {/* Data Preview */}
              <div className="py-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-md font-medium text-gray-900">
                    Muestra de Datos (primeras {previewData.rows.length} filas)
                  </h4>
                  {previewData.totalRows > 5 && (
                    <span className="text-sm text-gray-500">
                      Mostrando {previewData.rows.length} de {previewData.totalRows} registros
                    </span>
                  )}
                </div>
                
                <div className="overflow-x-auto max-h-96 border border-gray-200 rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        {previewData.headers.map((header, index) => (
                          <th
                            key={index}
                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 last:border-r-0"
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {previewData.rows.map((row, rowIndex) => (
                        <tr key={rowIndex} className="hover:bg-gray-50">
                          {previewData.headers.map((header, colIndex) => (
                            <td
                              key={colIndex}
                              className="px-4 py-3 text-xs text-gray-900 border-r border-gray-200 last:border-r-0 max-w-xs truncate"
                              title={row[header]}
                            >
                              {row[header] || '-'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end space-x-4 pt-4 border-t border-gray-200">
                <button
                  onClick={cancelPreview}
                  disabled={uploading}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmUpload}
                  disabled={uploading}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 flex items-center space-x-2"
                >
                  {uploading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Subiendo...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <span>Confirmar y Subir</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
