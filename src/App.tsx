import React, { ChangeEvent, useState } from 'react';
import './App.css';
import {getDocument, GlobalWorkerOptions, renderTextLayer } from "pdfjs-dist/legacy/build/pdf.js";
import {  PDFDocument, StandardFonts, rgb, degrees, ColorTypes } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { changeToPolishLetters } from './utils/changeToPolishLetters';
import { CSVToArray } from './utils/csvParser';
import { getFormatterTranslationsArray } from './utils/getFormattedTranslationsArray';
import { TextItem } from 'pdfjs-dist/types/src/display/api';

GlobalWorkerOptions.workerSrc = require("pdfjs-dist/build/pdf.worker.entry.js");

function App() {

  const [translations, setTranslations] = useState<{ [key: string]: string } | null>(null)
  const [checkedAllPages, setCheckedAllPages] = useState<boolean>(false)
  const [totalPdfPages, setTotalPdfPages] = useState<number>()
  const [dataToUseOnPDfWithTypeA, setDataToUseOnPDfWithTypeA] = useState<{[page: string]: string}>()
  const [dataToUseOnPDfWithTypeB, setDataToUseOnPDfWithTypeB] = useState<{[page: string]: {x: number, y: number, str: string}[]}>()
  const [pdfToEdit, setPdfToEdit] = useState<PDFDocument>()
  const [showPdfSpinner, setShowPdfSpinner] = useState<boolean>(false)
  const [showCsvFileError, setShowCsvFileError] = useState<boolean>(false)
  const [showPdfFileError, setShowPdfFileError] = useState<boolean>(false)
  const [labelType, setLabelType] = useState<'A'|'B'|null>(null)
  const [showLabelTypeError, setShowLabelTypeError] = useState<boolean>(false)

  async function pdfInputChange(e: ChangeEvent<HTMLInputElement>) {
    if (!translations || !labelType) {
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
            if (labelType === 'A') {
              const result: {[page: string]: string} = {};  
              allTextContents.forEach((textContent, index) => {
                textContent.items.forEach((item) => {
                    const str = (item as TextItem).str
                    if (translations![str] !== undefined) {
                      result[index]= translations![str]
                    }
                  })
                  setDataToUseOnPDfWithTypeA(result);
                  setCheckedAllPages(true);
              })
            } else if (labelType === 'B') {
              const result: {[page: string]: {x: number, y: number, str: string}[]} = {};  
              allTextContents.forEach((textContent, index) => {
                result[index] = [];
                textContent.items.forEach((item) => {
                  const element = (item as TextItem)
                    if (translations![element.str] !== undefined) {
                      const x = parseInt(element.transform[4])
                      const y = parseInt(element.transform[5])
                      result[index].push({x, y, str: translations![element.str]})
                    }
                  })
                  setDataToUseOnPDfWithTypeB(result);
                  setCheckedAllPages(true);
              })
              console.log(result)
            }
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
    if (!(pdfToEdit && (dataToUseOnPDfWithTypeA || dataToUseOnPDfWithTypeB))) {
      return;
    }

    const ubuntuFontBytes = await fetch('ubuntu-font.ttf').then((res) => res.arrayBuffer());
    pdfToEdit.registerFontkit(fontkit);
    const ubuntuFont  = await pdfToEdit.embedFont(ubuntuFontBytes)
    const pages = pdfToEdit.getPages()

    if (dataToUseOnPDfWithTypeA && labelType === 'A') {
      pages.forEach((page, pageNumber) => {
        page.drawText(dataToUseOnPDfWithTypeA[`${pageNumber}`] || '', {
          x: 7,
          y: 132,
          size: 10,
          font: ubuntuFont,
          color: rgb(0, 0, 0),
          rotate: degrees(0),
          maxWidth: 350,
          lineHeight: 12,
        })
      })
    } else if (dataToUseOnPDfWithTypeB && labelType === 'B') {
      pages.forEach((page, pageNumber) => {
        const elements = dataToUseOnPDfWithTypeB[`${pageNumber}`];
        elements.forEach(el => {
          page.drawRectangle({
            x: el.x - 70,
            y: el.y + 15,
            width: 275,
            height: 25,
            borderWidth: 2,
            borderColor: rgb(1,0,0),
            color: rgb(1,1,1)
          })
          page.drawText(el.str || '', {
            x: el.x - 67,
            y: el.y + 30,
            size: 8,
            font: ubuntuFont,
            color: rgb(0, 0, 0),
            rotate: degrees(0),
            maxWidth: 267,
            lineHeight: 10,
          })
        })
      })
    } else {
      return;
    }
  
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
    fileReader.readAsText(file, 'windows-1252')
  }

  function shouldDisableGeneratePdfButton() {
    return !(checkedAllPages && pdfToEdit !== undefined && (dataToUseOnPDfWithTypeA !== undefined || dataToUseOnPDfWithTypeB !== undefined) && !showPdfFileError && !showCsvFileError && labelType)
  }

  return (
    <div className="wrapper">

     {!labelType && (
      <div className="container">
        <div className="label-type-title">
          <div>Wybierz typ etykiet:</div>
          {showLabelTypeError && <div className="error-hint">Wybierz typ etykiet!</div>}          
        </div>
        <div className="mb-5 row">
          <div className="form-check col">
            <input className="form-check-input" type="radio" name="inlineRadioOptions" id="inlineRadio1" value="option1" onChange={() => setLabelType('A')}/>
            <label className="form-check-label" htmlFor="inlineRadio1">
              <img src="images/labels-type-A.png" className="label-type-image" />
            </label>
          </div>
          <div className="form-check col">
            <input className="form-check-input" type="radio" name="inlineRadioOptions" id="inlineRadio2" value="option2" onChange={() => setLabelType('B')}/>
            <label className="form-check-label" htmlFor="inlineRadio2">
            <img src="images/labels-type-B.png" className="label-type-image" />
            </label>
          </div>
        </div>
      </div>
     )}

    {labelType && (
      <div className="container">
        <div className="label-type-title">
          <div>
            <span>Wybrany typ etykiet:</span>
            <span>
                <button type="button" className="info-button" onClick={() => window.location.reload()}>
                  (Zmień)
                </button>
              </span>
          </div>
        </div>
        <div className="mb-5 center">
          <img src={`images/labels-type-${labelType}.png`} className="label-type-image" />
        </div>
      </div>
     )}

      {labelType && (
        <>
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
            <input type="file" id="translations-csv" className="form-control" onChange={parseCsv} disabled={!labelType}/>
            {showCsvFileError && <div className="error-hint">Wczytaj poprawny plik CSV!</div>}
          </div>

          <div className="mb-5">
            <label htmlFor="labels-pdf" className="form-label">
              Plik PDF z etykietami:&nbsp;
              {showPdfSpinner && <span className="hint">wczytywanie pliku...</span>}
              {pdfToEdit && dataToUseOnPDfWithTypeA && !showPdfSpinner && !showPdfFileError && <img src="images/check.jpg" className="check-icon"/>}
              </label>
            <input type="file" id="labels-pdf" className="form-control" onChange={pdfInputChange} disabled={!translations || !labelType} />
            {showPdfFileError && <div className="error-hint">Wczytaj poprawny plik PDF z etykietami!</div>}
            {totalPdfPages && !showPdfFileError && <div>Wczytano plik zawierający {totalPdfPages} stron.</div>}
          </div>

          <div className="wrapper-center">
            {shouldDisableGeneratePdfButton() && <button type="button" className="btn btn-secondary generate-button" disabled>Generuj PDF z tłumaczeniami</button>}
            {!shouldDisableGeneratePdfButton() && 
              <div>
                <div>
                  <button type="button" className="btn btn-success action-button" onClick={createModyfiedPdf}>Generuj PDF z tłumaczeniami</button>
                </div>
                <div>
                  <button type="button" className="btn btn-light action-button" onClick={() => window.location.reload()}>Zresetuj ustawienia</button>
                </div>
              </div>  
            }
          </div>
        </>
      )}
      
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
