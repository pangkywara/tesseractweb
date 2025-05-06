"use client";

import type React from "react";
import { useState, useEffect, useReducer } from "react";
import { AlertCircle, Loader2, RefreshCw, ArrowLeft, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Link from "next/link";

// Interface for DB result
interface DbResult {
    id: number; // Assuming ID is number from DB
    file_name: string | null;
    extracted_text: string | null;
    processed_at: string; // Keep as string for simplicity, format later
}

export default function HistoryPage() {
    const [dbResults, setDbResults] = useState<DbResult[] | null>(null);
    const [isFetchingResults, setIsFetchingResults] = useState<boolean>(false);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [isMounted, setIsMounted] = useState(false);

    // --- State for Deleting --- //
    // Reducer to manage loading state for individual row deletions
    type DeletingState = {
        [key: number]: boolean; // Map of resultId to deleting status
    };
    type DeletingAction = 
        | { type: 'START_DELETE'; id: number }
        | { type: 'END_DELETE'; id: number };

    function deletingReducer(state: DeletingState, action: DeletingAction): DeletingState {
        switch (action.type) {
            case 'START_DELETE':
                return { ...state, [action.id]: true };
            case 'END_DELETE':
                return { ...state, [action.id]: false };
            default:
                return state;
        }
    }
    const [deletingStatus, dispatchDeleting] = useReducer(deletingReducer, {});
    const [deleteError, setDeleteError] = useState<string | null>(null);
    // ------------------------- //

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const resultsUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}/ocr/results`; // URL for fetching results

    // Function to fetch results from the backend
    const fetchResults = async () => {
        setIsFetchingResults(true);
        setFetchError(null);
        try {
            const response = await fetch(resultsUrl);
            if (!response.ok) {
                let errorMsg = `API Error: ${response.status} ${response.statusText}`;
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.detail || JSON.stringify(errorData);
                } catch (e) {
                    console.error("Could not parse error response:", e);
                    errorMsg = await response.text();
                }
                throw new Error(errorMsg);
            }
            const data: DbResult[] = await response.json();
            setDbResults(data);
        } catch (err: any) {
            console.error("Failed to fetch results:", err);
            setFetchError(err.message || 'Gagal mengambil hasil dari database.'); // Indonesian
            setDbResults(null);
        } finally {
            setIsFetchingResults(false);
        }
    };

    // Fetch results on mount
    useEffect(() => {
        if (isMounted) {
            fetchResults();
        }
    }, [isMounted]); // Depend on isMounted

    // --- Delete Function --- //
    const handleDelete = async (id: number) => {
        // Simple confirmation
        if (!window.confirm(`Apakah Anda yakin ingin menghapus hasil dengan ID ${id}?`)) {
            return;
        }

        dispatchDeleting({ type: 'START_DELETE', id });
        setDeleteError(null); // Clear previous delete errors

        const deleteUrl = `${resultsUrl}/${id}`; // Construct URL with ID

        try {
            const response = await fetch(deleteUrl, {
                method: 'DELETE',
            });

            if (response.status === 204) { // Check for No Content success
                // Success: Update the state to remove the item
                setDbResults(prevResults => prevResults?.filter(result => result.id !== id) || null);
                console.log(`Successfully deleted result ${id}`);
            } else {
                // Handle other non-204 responses as errors
                let errorMsg = `Gagal menghapus: ${response.status} ${response.statusText}`;
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.detail || JSON.stringify(errorData);
                } catch (e) {
                    // Ignore error if response has no body or isn't JSON
                    console.warn("Could not parse error response body for delete");
                }
                throw new Error(errorMsg);
            }
        } catch (err: any) {
            console.error(`Failed to delete result ${id}:`, err);
            setDeleteError(err.message || `Gagal menghapus hasil ID ${id}.`);
        } finally {
            dispatchDeleting({ type: 'END_DELETE', id });
        }
    };
    // --------------------- //

    // Format date utility
    const formatDate = (dateString: string) => {
        try {
            // Using Indonesian locale for date formatting
            const lang = 'id-ID'; 
            return new Date(dateString).toLocaleString(lang, { dateStyle: 'medium', timeStyle: 'short' });
        } catch (e) {
            return dateString; // Fallback
        }
    };

    // Check for mount only (i18n check removed)
    if (!isMounted) {
        return ( // Simple loading state before mount
             <div className="min-h-screen flex items-center justify-center">
                 <Loader2 className="h-8 w-8 animate-spin" />
             </div>
        )
    }

    return (
        <main className="min-h-screen flex flex-col items-center p-4 md:p-8 bg-gray-100 dark:bg-gray-900">
            <div className="w-full max-w-4xl space-y-6">
                <div className="flex justify-between items-center mb-4">
                     <Button variant="outline" size="sm" asChild>
                       <Link href="/" className="flex items-center gap-1">
                            <ArrowLeft className="w-4 h-4" />
                            Kembali ke Utama {/* Indonesian */}
                        </Link>
                    </Button>
                     <h1 className="text-2xl font-bold text-center text-gray-800 dark:text-gray-200">
                         Riwayat Hasil OCR {/* Indonesian */}
                     </h1>
                     {/* Placeholder to balance the header or add future controls */}
                     <div className="w-20"></div>
                 </div>

                <p className="text-center text-gray-600 dark:text-gray-400 mb-6">
                     Hasil OCR yang disimpan sebelumnya. {/* Indonesian */}
                 </p>

                <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-4 md:p-6">
                    <div className="flex justify-end mb-4">
                         <Button variant="ghost" size="sm" onClick={fetchResults} disabled={isFetchingResults} title={'Muat Ulang Tabel'} className="flex items-center gap-1">
                             <RefreshCw className={`h-4 w-4 ${isFetchingResults ? 'animate-spin' : ''}`} />
                             Muat Ulang {/* Indonesian */}
                         </Button>
                     </div>

                    {/* Loading State */}
                     {isFetchingResults && (
                         <div className="flex justify-center items-center py-10">
                             <Loader2 className="h-6 w-6 animate-spin text-gray-500 dark:text-gray-400" />
                             <p className="ml-2 text-gray-500 dark:text-gray-400">Memuat Hasil...</p> {/* Indonesian */}
                         </div>
                     )}

                    {/* Error State */}
                     {fetchError && !isFetchingResults && (
                         <Alert variant="destructive" className="my-4">
                             <AlertCircle className="h-4 w-4" />
                             <AlertTitle>Kesalahan</AlertTitle> {/* Indonesian */}
                             <AlertDescription>{fetchError}</AlertDescription>
                         </Alert>
                     )}

                    {/* Table Display */}
                     {!isFetchingResults && !fetchError && dbResults && dbResults.length > 0 && (
                         <div className="overflow-x-auto"> {/* Ensure table is scrollable on small screens */}
                             <Table>
                                 <TableHeader>
                                      <TableRow>
                                         {/* Indonesian Table Headers */}
                                         <TableHead className="w-[100px]">ID</TableHead>
                                         <TableHead>Nama Berkas</TableHead>
                                         <TableHead>Teks Hasil Ekstraksi</TableHead>
                                         <TableHead className="text-right min-w-[150px]">Waktu Proses</TableHead>
                                         <TableHead className="text-right">Aksi</TableHead> {/* Indonesian */} 
                                     </TableRow>
                                 </TableHeader>
                                 <TableBody>
                                     {dbResults.map((result) => (
                                         <TableRow key={result.id}>
                                              {/* Display full ID or handle differently if needed */}
                                              <TableCell className="font-medium">{result.id}</TableCell>
                                              <TableCell className="max-w-[150px] truncate" title={result.file_name ?? undefined}>{result.file_name || '-'}</TableCell>
                                              <TableCell className="max-w-[250px] truncate" title={result.extracted_text ?? undefined}>
                                                  {result.extracted_text ? `${result.extracted_text.substring(0, 50)}...` : '-'}
                                              </TableCell>
                                              <TableCell className="text-right text-xs whitespace-nowrap">{formatDate(result.processed_at)}</TableCell>
                                              {/* --- Delete Button Cell --- */}
                                              <TableCell className="text-right">
                                                 <Button
                                                     variant="ghost" 
                                                     size="icon" 
                                                     onClick={() => handleDelete(result.id)}
                                                     disabled={deletingStatus[result.id] || isFetchingResults}
                                                     title={`Hapus ID ${result.id}`}
                                                     className="text-red-500 hover:text-red-700 disabled:opacity-50"
                                                 >
                                                     {deletingStatus[result.id] ? (
                                                         <Loader2 className="h-4 w-4 animate-spin" />
                                                     ) : (
                                                         <Trash2 className="h-4 w-4" />
                                                     )}
                                                 </Button>
                                             </TableCell>
                                             {/* ----------------------- */}
                                          </TableRow>
                                     ))}
                                 </TableBody>
                             </Table>
                         </div>
                     )}

                    {/* Empty State - Using ternary operator */}
                    { !isFetchingResults && !fetchError && (!dbResults || dbResults.length === 0) 
                      ? <p className="text-center text-gray-500 dark:text-gray-400 py-10">Tidak ada hasil ditemukan di database.</p> /* Indonesian */
                      : null 
                    }

                    {/* Display Delete Error */} 
                    {deleteError && (
                         <Alert variant="destructive" className="mt-4">
                             <AlertCircle className="h-4 w-4" />
                             <AlertTitle>Kesalahan Hapus</AlertTitle> {/* Indonesian */}
                             <AlertDescription>{deleteError}</AlertDescription>
                         </Alert>
                     )}
                </div>
            </div>
        </main>
    );
}
