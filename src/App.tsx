import React, { ChangeEvent, useState } from 'react';
import './App.css';
import {getDocument, GlobalWorkerOptions, renderTextLayer } from "pdfjs-dist/legacy/build/pdf.js";
import {  PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';
import { changeToPolishLetters } from './utils/changeToPolishLetters';
import { CSVToArray } from './utils/csvParser';
import { getFormatterTranslationsArray } from './utils/getFormattedTranslationsArray';
import { TextItem } from 'pdfjs-dist/types/src/display/api';

GlobalWorkerOptions.workerSrc = require("pdfjs-dist/build/pdf.worker.entry.js");

function App() {

  const [translations, setTranslations] = useState<{ [key: string]: string } | null>(null)
  const [checkedAllPages, setCheckedAllPages] = useState<boolean>(false)
  const [totalPdfPages, setTotalPdfPages] = useState<number>()
  const [dataToUseOnPDf, setDataToUseOnPDf] = useState<{[page: string]: string}>()
  const [pdfToEdit, setPdfToEdit] = useState<PDFDocument>()
  const [showPdfSpinner, setShowPdfSpinner] = useState<boolean>(false)
  const [showCsvFileError, setShowCsvFileError] = useState<boolean>(false)
  const [showPdfFileError, setShowPdfFileError] = useState<boolean>(false)

  async function pdfInputChange(e: ChangeEvent<HTMLInputElement>) {
    if (!translations) {
      return;
    }

    if (!e.target.files || e.target.files[0].type != "application/pdf") {
      setShowPdfFileError(true);
      return;
    }

    setShowPdfFileError(false);
    setShowPdfSpinner(true)

    const file = e.target.files[0]
    const fileReader = new FileReader();  
    fileReader.onload = async function() {
      const typedarray = new Uint8Array(fileReader.result as any);


      getDocument({data: typedarray}).promise
      .then(pdf => {
        const pages = pdf.numPages;
        setTotalPdfPages(pages)
        const allPromises = []
        for (let i = 1; i <= pages; i++) {
          allPromises.push(pdf.getPage(i))
        }

        Promise.all(allPromises).then(allPages => {
          const allPagesTextContents = []
          for (let j = 0; j < allPages.length; j++) {
            allPagesTextContents.push(allPages[j].getTextContent())
          }

          Promise.all(allPagesTextContents).then(allTextContents => {
            const result: {[page: string]: string} = {};  
            console.log('all contents: ', allTextContents.length)          
            allTextContents.forEach((textContent, index) => {
              textContent.items.forEach((item) => {
                  const str = (item as TextItem).str
                  if (translations![str] !== undefined) {
                    result[index]= translations![str]
                  }
                })
                setDataToUseOnPDf(result)
                setCheckedAllPages(true)
            })
          })
        })
      })
      .catch(err => {
        console.log('BLAD')
        console.log(err)
      })

      
      // otworzenie pdf do docelowej edycji
      const pdfDoc = await PDFDocument.load(typedarray)
      setPdfToEdit(pdfDoc);
      setShowPdfSpinner(false)
    }
    
    fileReader.readAsArrayBuffer(file);
  }
  
  async function createModyfiedPdf(): Promise<void> {
    if (!(pdfToEdit && dataToUseOnPDf)) {
      return;
    }
    
    const helveticaFont = await pdfToEdit.embedFont(StandardFonts.Helvetica)
    const pages = pdfToEdit.getPages()

      pages.forEach((page, pageNumber) => {
        page.drawText(dataToUseOnPDf[`${pageNumber}`] || '', {
          x: 7,
          y: 132,
          size: 10,
          font: helveticaFont,
          color: rgb(0, 0, 0),
          rotate: degrees(0),
          maxWidth: 350,
          lineHeight: 12,
        })
      })
    
      const pdfBytes = await pdfToEdit.save()

      var bytes = new Uint8Array(pdfBytes); // pass your byte response to this constructor
      var blob=new Blob([bytes], {type: "application/pdf"});// change resultByte to bytes

      var link=document.createElement('a');
      link.href=window.URL.createObjectURL(blob);
      link.download="myFileName.pdf";
      link.click();
  }


  async function parseCsv(e: ChangeEvent<HTMLInputElement>) {
    if (!e.target.files || !/\.csv$/i.test(e.target.files[0].name)) {
      setShowCsvFileError(true)
      return;
    }

    setShowCsvFileError(false)
    const file = e.target.files[0]
    const fileReader = new FileReader();  
    fileReader.onload = async function(result) {
      const csvArray = CSVToArray(fileReader.result?.toString(), ';')
      const formattedCsvArray = getFormatterTranslationsArray(csvArray)
      setTranslations(formattedCsvArray);
    }
    fileReader.readAsText(file, 'windows-1255')
  }

  function shouldDisableGeneratePdfButton() {
    return !(checkedAllPages && pdfToEdit !== undefined && dataToUseOnPDf !== undefined && !showPdfFileError && !showCsvFileError)
  }

  return (
    <div className="wrapper">
      <div className="mb-5">
        <label htmlFor="translations-csv" className="form-label">
          Plik CSV z tłumaczeniami:
          {translations && !showCsvFileError && <img src="images/check.jpg" className="check-icon"/>}
          <span>
            <button type="button" className="info-button" data-bs-toggle="modal" data-bs-target="#exampleModal">
              (Jak stworzyć plik CSV?)
            </button>
          </span>
          &nbsp;
        </label>
        <input type="file" id="translations-csv" className="form-control" onChange={parseCsv}/>
        {showCsvFileError && <div className="error-hint">Wczytaj poprawny plik CSV!</div>}
      </div>
      <div className="mb-5">
        <label htmlFor="labels-pdf" className="form-label">
          Plik PDF z etykietami:&nbsp;
          {showPdfSpinner && <span className="hint">wczytywanie pliku...</span>}
          {pdfToEdit && dataToUseOnPDf && !showPdfSpinner && !showPdfFileError && <img src="images/check.jpg" className="check-icon"/>}
          </label>
        <input type="file" id="labels-pdf" className="form-control" onChange={pdfInputChange} disabled={!translations}/>
        {showPdfFileError && <div className="error-hint">Wczytaj poprawny plik PDF z etykietami!</div>}
        {totalPdfPages && !showPdfFileError && <div>Wczytano plik zawierający {totalPdfPages} etykiet (stron).</div>}
      </div>
      <div className="wrapper-center">
        {shouldDisableGeneratePdfButton() && <button type="button" className="btn btn-secondary generate-button" disabled>Generuj PDF z tłumaczeniami</button>}
        {!shouldDisableGeneratePdfButton() && <button type="button" className="btn btn-success generate-button" onClick={createModyfiedPdf}>Generuj PDF z tłumaczeniami</button>}
      </div>

      <div className="modal fade" id="exampleModal" tabIndex={-1} aria-labelledby="exampleModalLabel" aria-hidden="true">
        <div className="modal-dialog modal-xl modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id="exampleModalLabel">Jak zapisać plik CSV?</h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div className="modal-body">
              <p>Wybierz z menu opcję "Zapisz jako", a następnie wybierz format pliku jako CSV rozdzielony przecinkami:</p>
              <div className="wrapper-center">
                <img src="images/how-save-csv.jpg" className="info-image" />
              </div>
              <p>Czasami może pojawić się dodatkowe okno z informacją o używanych w pliku makrach, formułach itp. Należy potwierdzić, że chcemy zapisać plik:</p>
              <div className="wrapper-center">
                <img src="images/confirm-save-csv.jpg" className="info-image" />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" data-bs-dismiss="modal">Zamknij</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
